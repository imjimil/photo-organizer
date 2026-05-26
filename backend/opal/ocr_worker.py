"""OCR worker with manifest-backed caching."""

import logging
from pathlib import Path

from opal.config import IMAGE_FOLDER, OCR_LANGUAGES
from opal.device import device_label, ocr_use_gpu, resolve_torch_device
from opal.manifest import Manifest, PhotoRecord

logger = logging.getLogger("photo_organizer.ocr_worker")

_reader = None


def _get_reader():
    global _reader
    if _reader is None:
        import easyocr

        gpu = ocr_use_gpu()
        torch_device = resolve_torch_device()
        if gpu:
            logger.info("Initializing EasyOCR (gpu=True, %s)", device_label(torch_device))
        else:
            logger.info(
                "Initializing EasyOCR (gpu=False, %s — OCR uses CPU on this platform)",
                device_label(torch_device),
            )
        _reader = easyocr.Reader(OCR_LANGUAGES, gpu=gpu)
    return _reader


def extract_exif_date(image_path: Path) -> str | None:
    """Extract capture date from EXIF if available."""
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS

        with Image.open(image_path) as img:
            exif = img.getexif()
            if not exif:
                return None
            for tag_id, value in exif.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag in ("DateTimeOriginal", "DateTime"):
                    # Format: "2024:03:15 12:30:00" -> "2024-03-15"
                    return str(value).split(" ")[0].replace(":", "-")
    except Exception:
        pass
    return None


def run_ocr(image_path: Path) -> str:
    """Run OCR on a single image and return extracted text."""
    reader = _get_reader()
    result = reader.readtext(str(image_path), detail=0)
    return " ".join(result)


def process_ocr_batch(
    manifest: Manifest,
    records: list[PhotoRecord],
    image_root: Path | None = None,
) -> dict[str, int]:
    """Run OCR on pending records and update manifest. Returns stats."""
    root = image_root or IMAGE_FOLDER
    stats = {"processed": 0, "failed": 0, "skipped": 0}

    for record in records:
        if record.status != "clip_done":
            stats["skipped"] += 1
            continue

        image_path = root / record.rel_path
        if not image_path.exists():
            manifest.mark_failed(record.id, f"File not found: {record.rel_path}")
            stats["failed"] += 1
            continue

        try:
            ocr_text = run_ocr(image_path)
            exif_date = extract_exif_date(image_path)
            manifest.mark_ocr_done(record.id, ocr_text, exif_date)
            stats["processed"] += 1
            logger.debug("OCR done: %s (%d chars)", record.rel_path, len(ocr_text))
        except Exception as exc:
            manifest.mark_failed(record.id, str(exc))
            stats["failed"] += 1
            logger.error("OCR failed for %s: %s", record.rel_path, exc)

    return stats
