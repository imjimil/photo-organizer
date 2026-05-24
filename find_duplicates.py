"""Fast exact-duplicate finder — file size + SHA-256, no AI."""

import argparse
import csv
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path

from config import IMAGE_FOLDER, setup_logging
from scanner import compute_content_hash, scan_images

logger = logging.getLogger("photo_organizer.find_duplicates")


@dataclass
class DuplicateGroup:
    content_hash: str
    size_bytes: int
    files: list[str]
    canonical: str

    @property
    def copy_count(self) -> int:
        return len(self.files) - 1

    @property
    def wasted_bytes(self) -> int:
        return self.size_bytes * self.copy_count


@dataclass
class DuplicateReport:
    image_folder: str
    total_files: int
    unique_files: int
    duplicate_files: int
    duplicate_groups: int
    wasted_bytes: int
    groups: list[DuplicateGroup]


def find_exact_duplicates(root: Path | None = None) -> DuplicateReport:
    """Find byte-identical images. Only hashes files that share a size with another."""
    root = (root or IMAGE_FOLDER).resolve()
    scanned = scan_images(root)

    by_size: dict[int, list] = defaultdict(list)
    for item in scanned:
        by_size[item.file_size].append(item)

    by_hash: dict[str, list[str]] = defaultdict(list)
    path_to_size = {item.rel_path: item.file_size for item in scanned}

    unique_by_size = 0
    hashed_count = 0
    for size, items in by_size.items():
        if len(items) == 1:
            unique_by_size += 1
            continue
        for item in items:
            content_hash = compute_content_hash(item.abs_path)
            by_hash[content_hash].append(item.rel_path)
            hashed_count += 1

    logger.info(
        "Hashed %d files (%d skipped - unique file size)",
        hashed_count,
        unique_by_size,
    )

    groups: list[DuplicateGroup] = []
    duplicate_files = 0
    wasted_bytes = 0

    for content_hash, paths in sorted(by_hash.items(), key=lambda x: -len(x[1])):
        if len(paths) < 2:
            continue
        paths = sorted(paths)
        size_bytes = path_to_size[paths[0]]
        group = DuplicateGroup(
            content_hash=content_hash,
            size_bytes=size_bytes,
            files=paths,
            canonical=paths[0],
        )
        groups.append(group)
        duplicate_files += group.copy_count
        wasted_bytes += group.wasted_bytes

    total = len(scanned)
    unique = total - duplicate_files

    return DuplicateReport(
        image_folder=str(root),
        total_files=total,
        unique_files=unique,
        duplicate_files=duplicate_files,
        duplicate_groups=len(groups),
        wasted_bytes=wasted_bytes,
        groups=groups,
    )


def print_summary(report: DuplicateReport) -> None:
    wasted_mb = report.wasted_bytes / (1024 * 1024)
    print()
    print("=== Duplicate Scan Summary ===")
    print(f"Folder:            {report.image_folder}")
    print(f"Total files:       {report.total_files:,}")
    print(f"Unique images:     {report.unique_files:,}")
    print(f"Duplicate copies:  {report.duplicate_files:,}")
    print(f"Duplicate groups:  {report.duplicate_groups:,}")
    print(f"Wasted disk space: {wasted_mb:.1f} MB")
    print()

    if report.groups:
        print("Largest duplicate groups:")
        for group in report.groups[:10]:
            print(f"  {len(group.files)} copies ({group.size_bytes:,} bytes each)")
            print(f"    keep: {group.canonical}")
            for path in group.files[1:3]:
                print(f"    dup:  {path}")
            if len(group.files) > 3:
                print(f"    ... and {len(group.files) - 3} more")
        if len(report.groups) > 10:
            print(f"  ... and {len(report.groups) - 10} more groups")
    else:
        print("No exact duplicates found.")


def export_json(report: DuplicateReport, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": {
            "image_folder": report.image_folder,
            "total_files": report.total_files,
            "unique_files": report.unique_files,
            "duplicate_files": report.duplicate_files,
            "duplicate_groups": report.duplicate_groups,
            "wasted_bytes": report.wasted_bytes,
        },
        "groups": [asdict(g) for g in report.groups],
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def export_csv(report: DuplicateReport, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "content_hash",
                "size_bytes",
                "group_size",
                "is_canonical",
                "rel_path",
                "wasted_bytes",
            ],
        )
        writer.writeheader()
        for group in report.groups:
            for path in group.files:
                writer.writerow(
                    {
                        "content_hash": group.content_hash,
                        "size_bytes": group.size_bytes,
                        "group_size": len(group.files),
                        "is_canonical": path == group.canonical,
                        "rel_path": path,
                        "wasted_bytes": group.wasted_bytes if path != group.canonical else 0,
                    }
                )


def delete_duplicates(
    report: DuplicateReport,
    root: Path,
    dry_run: bool = False,
) -> list[dict]:
    """Delete duplicate copies, keeping the canonical file in each group."""
    log: list[dict] = []
    deleted = 0
    freed_bytes = 0
    failed = 0

    for group in report.groups:
        for rel_path in group.files:
            if rel_path == group.canonical:
                continue

            file_path = root / rel_path
            entry = {
                "rel_path": rel_path,
                "kept": group.canonical,
                "size_bytes": group.size_bytes,
                "dry_run": dry_run,
            }

            if not file_path.exists():
                entry["status"] = "missing"
                log.append(entry)
                continue

            if dry_run:
                entry["status"] = "would_delete"
                log.append(entry)
                deleted += 1
                freed_bytes += group.size_bytes
                continue

            try:
                file_path.unlink()
                entry["status"] = "deleted"
                deleted += 1
                freed_bytes += group.size_bytes
                logger.debug("Deleted %s (kept %s)", rel_path, group.canonical)
            except OSError as exc:
                entry["status"] = "failed"
                entry["error"] = str(exc)
                failed += 1
                logger.error("Failed to delete %s: %s", rel_path, exc)

            log.append(entry)

    action = "Would delete" if dry_run else "Deleted"
    logger.info(
        "%s %d duplicate files (%.1f MB)%s",
        action,
        deleted,
        freed_bytes / (1024 * 1024),
        f", {failed} failed" if failed else "",
    )
    return log


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find byte-identical images (fast, no AI)."
    )
    parser.add_argument(
        "--folder",
        type=str,
        default="",
        help="Image folder to scan (default: IMAGE_FOLDER env / config)",
    )
    parser.add_argument(
        "--export",
        type=str,
        default="",
        help="Export path (.json or .csv)",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Delete duplicate copies (keeps one file per group)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="With --delete: show what would be removed without deleting",
    )
    args = parser.parse_args()
    setup_logging()

    root = Path(args.folder) if args.folder else IMAGE_FOLDER
    root = root.resolve()
    logger.info("Scanning %s for exact duplicates...", root)

    report = find_exact_duplicates(root)
    print_summary(report)

    if args.export:
        out = Path(args.export)
        if out.suffix.lower() == ".csv":
            export_csv(report, out)
        else:
            export_json(report, out)
        logger.info("Exported report to %s", out)

    if args.delete or args.dry_run:
        if not report.groups:
            logger.info("Nothing to delete.")
            return

        deletion_log = delete_duplicates(report, root, dry_run=args.dry_run)
        log_path = Path("deleted_duplicates.json")
        log_path.write_text(json.dumps(deletion_log, indent=2), encoding="utf-8")
        logger.info("Deletion log written to %s", log_path)


if __name__ == "__main__":
    main()
