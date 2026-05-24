"""Thumbnail cache for faster UI rendering."""

import logging
from pathlib import Path

from PIL import Image

from config import IMAGE_FOLDER, THUMB_CACHE_PATH, THUMB_SIZE, ensure_dirs

logger = logging.getLogger("photo_organizer.thumbnails")


def thumb_path(photo_id: str) -> Path:
    return THUMB_CACHE_PATH / f"{photo_id}.webp"


def generate_thumbnail(
    image_path: Path, photo_id: str, size: int | None = None
) -> Path | None:
    """Generate and cache a WebP thumbnail. Returns path or None on failure."""
    ensure_dirs()
    out_path = thumb_path(photo_id)
    if out_path.exists():
        return out_path

    try:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            img.thumbnail((size or THUMB_SIZE, size or THUMB_SIZE))
            img.save(out_path, "WEBP", quality=85)
        return out_path
    except Exception as exc:
        logger.warning("Thumbnail failed for %s: %s", image_path, exc)
        return None


def get_display_image(
    photo_id: str, rel_path: str, image_root: Path | None = None
) -> Path | None:
    """Return cached thumbnail path, generating if needed. Falls back to original."""
    root = image_root or IMAGE_FOLDER
    image_path = root / rel_path
    if not image_path.exists():
        return None

    cached = generate_thumbnail(image_path, photo_id)
    return cached or image_path
