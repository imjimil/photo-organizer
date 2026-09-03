"""Central configuration for paths, batch sizes, and model settings."""

import logging
import os
from pathlib import Path

from opal.device import configure_mps_fallback, default_clip_batch_size, resolve_torch_device

configure_mps_fallback()

# Paths (override via environment variables)
IMAGE_FOLDER = Path(
    os.getenv("IMAGE_FOLDER", r"C:\Users\praja\Downloads\Demo_data_video")
)
CHROMA_PATH = Path(os.getenv("CHROMA_PATH", "./my_quote_library"))
MANIFEST_PATH = Path(os.getenv("MANIFEST_PATH", "./data/manifest.db"))
THUMB_CACHE_PATH = Path(os.getenv("THUMB_CACHE_PATH", "./.cache/thumbs"))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "quotes_collection")

# Models
CLIP_MODEL = os.getenv("CLIP_MODEL", "google/siglip2-base-patch16-256")
OCR_ENGINE = os.getenv("OCR_ENGINE", "rapidocr")
OCR_LANGUAGES = os.getenv("OCR_LANGUAGES", "en").split(",")

# Batch sizes (SigLIP default scales with GPU: cuda=16, mps=8, cpu=4)
_clip_batch_env = os.getenv("CLIP_BATCH_SIZE")
CLIP_BATCH_SIZE = (
    int(_clip_batch_env)
    if _clip_batch_env
    else default_clip_batch_size(resolve_torch_device())
)
CHROMA_BATCH_SIZE = int(os.getenv("CHROMA_BATCH_SIZE", "500"))
OCR_BATCH_LOG_INTERVAL = int(os.getenv("OCR_BATCH_LOG_INTERVAL", "50"))

# Thumbnails
THUMB_SIZE = int(os.getenv("THUMB_SIZE", "256"))

# Image extensions
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}

# Auto-index when files appear/change/disappear under source folders
FOLDER_WATCH = os.getenv("FOLDER_WATCH", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
FOLDER_WATCH_DEBOUNCE_SEC = float(os.getenv("FOLDER_WATCH_DEBOUNCE_SEC", "2.5"))

# Duplicate detection
DUPLICATE_THRESHOLD = float(os.getenv("DUPLICATE_THRESHOLD", "0.95"))

# Device (auto-detected at runtime if not set)
DEVICE = os.getenv("DEVICE", "")


def setup_logging(level: str | None = None) -> logging.Logger:
    """Configure structured logging for pipeline jobs."""
    log_level = getattr(logging, (level or os.getenv("LOG_LEVEL", "INFO")).upper())
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    return logging.getLogger("photo_organizer")


def ensure_dirs() -> None:
    """Create runtime directories if they do not exist."""
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    THUMB_CACHE_PATH.mkdir(parents=True, exist_ok=True)
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
