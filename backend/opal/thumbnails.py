"""Thumbnail cache for faster UI rendering."""

import logging
from pathlib import Path

from PIL import Image

from opal.config import IMAGE_FOLDER, THUMB_CACHE_PATH, THUMB_SIZE, ensure_dirs

logger = logging.getLogger("photo_organizer.thumbnails")


def thumb_path(photo_id: str) -> Path:
    return THUMB_CACHE_PATH / f"{photo_id}.webp"


def read_dimensions(image_path: Path) -> tuple[int, int] | None:
    """Read pixel dimensions from a file without decoding the full image."""
    try:
        with Image.open(image_path) as img:
            w, h = img.size
            if w > 0 and h > 0:
                return int(w), int(h)
    except Exception as exc:
        logger.debug("Read dimensions failed for %s: %s", image_path, exc)
    return None


def generate_thumbnail(
    image_path: Path,
    photo_id: str,
    size: int | None = None,
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


def generate_thumbnail_with_dims(
    image_path: Path,
    photo_id: str,
    size: int | None = None,
) -> tuple[Path | None, tuple[int, int] | None]:
    """Like generate_thumbnail but also returns the original (w, h)."""
    ensure_dirs()
    out_path = thumb_path(photo_id)
    dims: tuple[int, int] | None = None

    try:
        with Image.open(image_path) as img:
            ow, oh = img.size
            if ow > 0 and oh > 0:
                dims = (int(ow), int(oh))
            if not out_path.exists():
                rgb = img.convert("RGB")
                rgb.thumbnail((size or THUMB_SIZE, size or THUMB_SIZE))
                rgb.save(out_path, "WEBP", quality=85)
        return out_path, dims
    except Exception as exc:
        logger.warning("Thumbnail failed for %s: %s", image_path, exc)
        if out_path.exists():
            return out_path, dims
        return None, dims


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
