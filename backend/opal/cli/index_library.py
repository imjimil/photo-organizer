"""Batch indexing pipeline: scan, CLIP embed, Chroma upsert, OCR, thumbnails."""

import argparse
import logging
from pathlib import Path

from tqdm import tqdm

from opal.chroma_store import ChromaStore
from opal.config import CLIP_BATCH_SIZE, CHROMA_PATH, IMAGE_FOLDER, MANIFEST_PATH, THUMB_CACHE_PATH, setup_logging
from opal.embedder import CLIPEmbedder
from opal.manifest import Manifest, PhotoRecord, path_id
from opal.ocr_worker import process_ocr_batch
from opal.organizer import (
    execute_organization,
    export_duplicates,
    export_log,
    find_duplicates,
    plan_exif_organization,
)
from opal.scanner import scan_images
from opal.thumbnails import generate_thumbnail

logger = logging.getLogger("photo_organizer.index")


def reset_index_data() -> None:
    """Delete manifest, Chroma index, and thumbnail cache for a clean re-index."""
    import shutil

    paths = [
        MANIFEST_PATH,
        CHROMA_PATH,
        THUMB_CACHE_PATH,
    ]
    for path in paths:
        if path.is_dir():
            shutil.rmtree(path)
            logger.info("Removed directory %s", path)
        elif path.is_file():
            path.unlink()
            logger.info("Removed file %s", path)


def sync_manifest(manifest: Manifest, chroma: ChromaStore | None = None) -> dict[str, int]:
    """Scan filesystem and sync with manifest. Returns scan stats."""
    scanned = scan_images(IMAGE_FOLDER)
    scanned_paths = {s.rel_path for s in scanned}
    stats = {"scanned": len(scanned), "new_or_changed": 0, "unchanged": 0, "identical": 0}
    stale_ids: list[str] = []

    existing_paths = manifest.get_all_rel_paths()
    missing = existing_paths - scanned_paths
    if missing:
        removed = manifest.mark_missing(missing)
        stats["marked_missing"] = removed
        logger.info("Marked %d files as missing", removed)

    for item in scanned:
        _, needs_reindex, stale_chroma_id, is_identical = manifest.upsert_scanned(item)
        if stale_chroma_id:
            stale_ids.append(stale_chroma_id)
        if is_identical:
            stats["identical"] += 1
        elif needs_reindex:
            stats["new_or_changed"] += 1
        else:
            stats["unchanged"] += 1

    if stats["identical"]:
        unique = stats["scanned"] - stats["identical"]
        logger.info(
            "Found %d identical copies (same image, different filename). "
            "Will embed %d unique images — this is normal and saves GPU time.",
            stats["identical"],
            unique,
        )

    if stale_ids and chroma:
        chroma.delete_ids(stale_ids)
        logger.info("Removed %d stale vectors from Chroma", len(stale_ids))

    return stats


def run_clip_phase(
    manifest: Manifest,
    chroma: ChromaStore,
    embedder: CLIPEmbedder,
    records: list[PhotoRecord] | None = None,
) -> dict[str, int]:
    """Batch CLIP embedding and Chroma upsert for pending records."""
    pending = records or manifest.get_pending_clip()
    stats = {"embedded": 0, "failed": 0, "skipped": 0}

    if not pending:
        logger.info("No files pending CLIP embedding")
        return stats

    paths = [IMAGE_FOLDER / r.rel_path for r in pending]
    valid_records: list[PhotoRecord] = []
    valid_paths: list[Path] = []

    for record, path in zip(pending, paths):
        if not path.exists():
            manifest.mark_failed(record.id, f"File not found: {record.rel_path}")
            stats["failed"] += 1
            continue
        valid_records.append(record)
        valid_paths.append(path)

    if not valid_paths:
        return stats

    batch_size = CLIP_BATCH_SIZE
    total = len(valid_paths)
    logger.info("Embedding %d images (batch size %d)", total, batch_size)

    progress = tqdm(total=total, desc="CLIP embedding", unit="img")
    for start in range(0, total, batch_size):
        batch_records = valid_records[start : start + batch_size]
        batch_paths = valid_paths[start : start + batch_size]

        try:
            vectors = embedder.embed_images_batch(batch_paths, batch_size=len(batch_paths))
        except Exception as exc:
            logger.error("Batch embedding failed at %d: %s", start, exc)
            for record in batch_records:
                manifest.mark_failed(record.id, str(exc))
            stats["failed"] += len(batch_records)
            progress.update(len(batch_records))
            continue

        ids: list[str] = []
        embeddings: list[list[float]] = []
        documents: list[str] = []
        metadatas: list[dict] = []

        for record, vector in zip(batch_records, vectors):
            chroma_id = record.content_hash
            ids.append(chroma_id)
            embeddings.append(vector)
            documents.append(record.ocr_text or "")
            metadatas.append(
                {
                    "id": chroma_id,
                    "rel_path": record.rel_path,
                    "has_text": record.has_text,
                }
            )
            manifest.mark_clip_done(record.id)
            stats["embedded"] += 1

        chroma.upsert_batch(ids, embeddings, documents, metadatas)
        progress.update(len(batch_records))

    progress.close()
    logger.info("Upserted %d embeddings to Chroma", stats["embedded"])
    return stats


def update_chroma_documents(manifest: Manifest, chroma: ChromaStore) -> int:
    """Sync OCR text from manifest into Chroma documents after OCR phase."""
    records = manifest.get_all_indexed()
    if not records:
        return 0

    ids = [r.id for r in records if r.ocr_text]
    if not ids:
        return 0

    updated = 0
    batch_ids: list[str] = []
    batch_docs: list[str] = []
    batch_meta: list[dict] = []

    for record in records:
        if record.duplicate_of or not record.ocr_text:
            continue
        batch_ids.append(record.content_hash)
        batch_docs.append(record.ocr_text)
        batch_meta.append(
            {
                "id": record.content_hash,
                "rel_path": record.rel_path,
                "has_text": record.has_text,
            }
        )

        if len(batch_ids) >= 500:
            chroma.collection.update(
                ids=batch_ids, documents=batch_docs, metadatas=batch_meta
            )
            updated += len(batch_ids)
            batch_ids, batch_docs, batch_meta = [], [], []

    if batch_ids:
        chroma.collection.update(
            ids=batch_ids, documents=batch_docs, metadatas=batch_meta
        )
        updated += len(batch_ids)

    return updated


def run_ocr_phase(manifest: Manifest) -> dict[str, int]:
    """Run OCR on clip_done records."""
    pending = manifest.get_pending_ocr()
    if not pending:
        logger.info("No files pending OCR")
        return {"processed": 0, "failed": 0, "skipped": 0}

    logger.info("Running OCR on %d files", len(pending))
    stats = {"processed": 0, "failed": 0, "skipped": 0}
    for i in tqdm(range(0, len(pending), 1), desc="OCR", total=len(pending)):
        batch_stats = process_ocr_batch(manifest, [pending[i]])
        for key in stats:
            stats[key] += batch_stats[key]
    return stats


def run_thumbnails(manifest: Manifest) -> int:
    """Generate thumbnails for all indexed photos."""
    records = manifest.get_all_indexed()
    count = 0
    for record in tqdm(records, desc="Thumbnails"):
        path = IMAGE_FOLDER / record.rel_path
        if path.exists() and generate_thumbnail(path, path_id(record.rel_path)):
            count += 1
    return count


def print_summary(manifest: Manifest, chroma: ChromaStore) -> None:
    """Print indexing job summary."""
    status_counts = manifest.count_by_status()
    logger.info("=== Index Summary ===")
    logger.info("Manifest total: %d", manifest.total_count())
    for status, count in sorted(status_counts.items()):
        logger.info("  %s: %d", status, count)
    logger.info("Chroma vectors: %d", chroma.count())


def run_index(
    clip: bool = True,
    ocr: bool = True,
    thumbnails: bool = True,
    incremental: bool = True,
) -> None:
    """Run the indexing pipeline."""
    manifest = Manifest()
    chroma = ChromaStore()

    scan_stats = sync_manifest(manifest, chroma)
    logger.info(
        "Scan complete: %d files, %d new/changed, %d unchanged",
        scan_stats["scanned"],
        scan_stats["new_or_changed"],
        scan_stats["unchanged"],
    )

    pending_clip = manifest.get_pending_clip()
    if clip:
        if incremental and not pending_clip and scan_stats["new_or_changed"] == 0:
            logger.info("No changes detected — skipping CLIP phase")
        else:
            embedder = CLIPEmbedder()
            clip_stats = run_clip_phase(manifest, chroma, embedder)
            logger.info("CLIP phase: %s", clip_stats)

    if ocr:
        ocr_stats = run_ocr_phase(manifest)
        logger.info("OCR phase: %s", ocr_stats)
        updated = update_chroma_documents(manifest, chroma)
        logger.info("Updated %d Chroma documents with OCR text", updated)

    if thumbnails:
        thumb_count = run_thumbnails(manifest)
        logger.info("Generated %d thumbnails", thumb_count)

    print_summary(manifest, chroma)


def main() -> None:
    parser = argparse.ArgumentParser(description="Photo library indexer")
    parser.add_argument(
        "--mode",
        choices=["incremental", "full", "clip", "ocr", "dedup", "organize"],
        default="incremental",
        help="Indexing mode (default: incremental)",
    )
    parser.add_argument(
        "--no-thumbnails", action="store_true", help="Skip thumbnail generation"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dry-run for organize mode (no file moves)",
    )
    parser.add_argument(
        "--export",
        type=str,
        default="",
        help="Export path for organize/dedup results (JSON or CSV)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete manifest, Chroma DB, and thumbnail cache before indexing",
    )
    args = parser.parse_args()
    setup_logging()

    if args.reset:
        reset_index_data()
        logger.info("Index data reset — starting fresh")

    if args.mode == "clip":
        manifest = Manifest()
        chroma = ChromaStore()
        sync_manifest(manifest, chroma)
        embedder = CLIPEmbedder()
        stats = run_clip_phase(manifest, chroma, embedder)
        logger.info("CLIP-only complete: %s", stats)
        print_summary(manifest, chroma)
    elif args.mode == "ocr":
        manifest = Manifest()
        stats = run_ocr_phase(manifest)
        chroma = ChromaStore()
        updated = update_chroma_documents(manifest, chroma)
        logger.info("OCR-only complete: %s, updated %d docs", stats, updated)
        print_summary(manifest, chroma)
    elif args.mode == "dedup":
        manifest = Manifest()
        chroma = ChromaStore()
        groups = find_duplicates(chroma, manifest)
        logger.info("Found %d duplicate groups", len(groups))
        if args.export:
            path = export_duplicates(groups, Path(args.export))
            logger.info("Exported duplicates to %s", path)
    elif args.mode == "organize":
        manifest = Manifest()
        plans = plan_exif_organization(manifest)
        logger.info("Planned %d file moves", len(plans))
        log = execute_organization(plans, dry_run=args.dry_run)
        if args.export:
            fmt = "csv" if args.export.endswith(".csv") else "json"
            path = export_log(log, Path(args.export), fmt=fmt)
            logger.info("Exported organize log to %s", path)
        moved = sum(1 for e in log if e["status"] == "moved")
        logger.info("Organize complete: %d moved, dry_run=%s", moved, args.dry_run)
    elif args.mode == "full":
        run_index(clip=True, ocr=True, thumbnails=not args.no_thumbnails, incremental=False)
    else:
        run_index(
            clip=True,
            ocr=True,
            thumbnails=not args.no_thumbnails,
            incremental=True,
        )


if __name__ == "__main__":
    main()
