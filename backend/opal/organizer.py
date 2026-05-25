"""Photo organizer: EXIF-based folder layout, duplicate detection, dry-run export."""

import csv
import json
import logging
import shutil
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path

from chroma_store import ChromaStore
from config import DUPLICATE_THRESHOLD, IMAGE_FOLDER
from manifest import Manifest, PhotoRecord
from ocr_worker import extract_exif_date

logger = logging.getLogger("photo_organizer.organizer")


@dataclass
class MovePlan:
    rel_path: str
    dest_rel_path: str
    reason: str


@dataclass
class DuplicateGroup:
    canonical_id: str
    duplicate_ids: list[str]
    similarity: float


def find_duplicates(
    chroma: ChromaStore,
    manifest: Manifest,
    threshold: float | None = None,
) -> list[DuplicateGroup]:
    """Find near-duplicate images using Chroma nearest-neighbor queries."""
    threshold = threshold or DUPLICATE_THRESHOLD
    ids, embeddings = chroma.get_all_embeddings()
    if len(ids) < 2:
        return []

    groups: list[DuplicateGroup] = []
    seen: set[str] = set()

    for photo_id, embedding in zip(ids, embeddings):
        if photo_id in seen:
            continue

        results = chroma.collection.query(
            query_embeddings=[embedding],
            n_results=min(10, len(ids)),
            include=["distances"],
        )
        result_ids = results.get("ids", [[]])[0]
        distances = results.get("distances", [[]])[0]

        duplicates: list[str] = []
        max_sim = 0.0
        for match_id, distance in zip(result_ids, distances):
            if match_id == photo_id or match_id in seen:
                continue
            similarity = 1.0 - distance
            if similarity >= threshold:
                duplicates.append(match_id)
                seen.add(match_id)
                max_sim = max(max_sim, similarity)

        if duplicates:
            seen.add(photo_id)
            for dup_id in duplicates:
                manifest.mark_duplicate(dup_id, photo_id)
            groups.append(
                DuplicateGroup(
                    canonical_id=photo_id,
                    duplicate_ids=duplicates,
                    similarity=max_sim,
                )
            )
            logger.info(
                "Duplicate group: %s -> %d copies (sim=%.3f)",
                photo_id[:8],
                len(duplicates),
                max_sim,
            )

    return groups


def _resolve_date_folder(record: PhotoRecord, abs_path: Path) -> str:
    """Return YYYY/MM subfolder from EXIF or file mtime."""
    date_str = record.exif_date
    if not date_str:
        date_str = extract_exif_date(abs_path)
    if date_str:
        parts = date_str.split("-")
        if len(parts) >= 2:
            return f"{parts[0]}/{parts[1]}"

    mtime = datetime.fromtimestamp(abs_path.stat().st_mtime)
    return f"{mtime.year}/{mtime.month:02d}"


def plan_exif_organization(
    manifest: Manifest,
    dest_root: Path | None = None,
) -> list[MovePlan]:
    """Plan moves into YYYY/MM/ folders based on EXIF or mtime."""
    root = IMAGE_FOLDER
    dest = dest_root or root
    plans: list[MovePlan] = []

    for record in manifest.get_all_indexed():
        src = root / record.rel_path
        if not src.exists():
            continue

        date_folder = _resolve_date_folder(record, src)
        filename = Path(record.rel_path).name
        dest_rel = f"{date_folder}/{filename}"

        if dest_rel != record.rel_path:
            plans.append(
                MovePlan(
                    rel_path=record.rel_path,
                    dest_rel_path=dest_rel,
                    reason=f"organize_by_exif -> {date_folder}",
                )
            )

    return plans


def execute_organization(
    plans: list[MovePlan],
    dest_root: Path | None = None,
    dry_run: bool = True,
) -> list[dict]:
    """Execute or simulate file moves. Returns audit log entries."""
    root = IMAGE_FOLDER
    dest = dest_root or root
    log: list[dict] = []

    for plan in plans:
        src = root / plan.rel_path
        target = dest / plan.dest_rel_path
        entry = {
            "src": plan.rel_path,
            "dest": plan.dest_rel_path,
            "reason": plan.reason,
            "dry_run": dry_run,
            "status": "planned",
        }

        if not src.exists():
            entry["status"] = "missing"
            log.append(entry)
            continue

        if dry_run:
            entry["status"] = "dry_run"
            log.append(entry)
            continue

        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                entry["status"] = "skipped_exists"
            else:
                shutil.move(str(src), str(target))
                entry["status"] = "moved"
        except Exception as exc:
            entry["status"] = "failed"
            entry["error"] = str(exc)
            logger.error("Move failed %s -> %s: %s", plan.rel_path, plan.dest_rel_path, exc)

        log.append(entry)

    return log


def export_log(log: list[dict], output_path: Path, fmt: str = "json") -> Path:
    """Export move/organize audit log to JSON or CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "csv":
        if not log:
            output_path.write_text("", encoding="utf-8")
            return output_path
        with output_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=log[0].keys())
            writer.writeheader()
            writer.writerows(log)
    else:
        output_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
    return output_path


def export_duplicates(
    groups: list[DuplicateGroup], output_path: Path
) -> Path:
    """Export duplicate groups to JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = [asdict(g) for g in groups]
    output_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return output_path
