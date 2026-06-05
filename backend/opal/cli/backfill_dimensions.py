"""Backfill width/height for photos missing dimensions.

Reads either the cached thumbnail (fast, preserves aspect ratio of source)
or, when a thumbnail is unavailable, the original file. Updates the manifest.
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from tqdm import tqdm

from opal.config import IMAGE_FOLDER, setup_logging
from opal.manifest import Manifest
from opal.thumbnails import read_dimensions, thumb_path

logger = logging.getLogger("photo_organizer.dimensions")


def backfill(limit: int | None = None) -> dict[str, int]:
    setup_logging()
    manifest = Manifest()
    records = manifest.list_missing_dimensions(limit=limit)

    stats = {"checked": 0, "filled_from_thumb": 0, "filled_from_source": 0, "skipped": 0}

    for record in tqdm(records, desc="Dimensions"):
        stats["checked"] += 1

        thumb = thumb_path(record.id)
        dims = read_dimensions(thumb) if thumb.exists() else None

        if not dims:
            root = manifest.get_source_root(record.source_id) or IMAGE_FOLDER
            source = root / record.rel_path
            if source.exists():
                src_dims = read_dimensions(source)
                if src_dims:
                    manifest.update_dimensions(record.id, src_dims[0], src_dims[1])
                    stats["filled_from_source"] += 1
                    continue
            stats["skipped"] += 1
            continue

        # Thumbnails preserve aspect ratio. Use thumb dims as a 1:1 proxy for
        # the original aspect; absolute pixel size doesn't affect mosaic layout.
        manifest.update_dimensions(record.id, dims[0], dims[1])
        stats["filled_from_thumb"] += 1

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill missing photo dimensions.")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most N rows (default: all rows missing dimensions).",
    )
    args = parser.parse_args()
    stats = backfill(limit=args.limit)
    logger.info(
        "Done. checked=%d filled_from_thumb=%d filled_from_source=%d skipped=%d",
        stats["checked"],
        stats["filled_from_thumb"],
        stats["filled_from_source"],
        stats["skipped"],
    )


if __name__ == "__main__":
    main()
