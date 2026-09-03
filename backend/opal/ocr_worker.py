"""OCR worker with manifest-backed caching."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from opal.config import IMAGE_FOLDER, OCR_LANGUAGES
from opal.device import device_label, ocr_use_gpu, resolve_torch_device
from opal.manifest import Manifest, PhotoRecord

logger = logging.getLogger("photo_organizer.ocr_worker")

_reader = None
_path_bootstrapped = False


def _ensure_torch_cuda_dlls() -> None:
    """Put Torch's CUDA DLLs on PATH so onnxruntime-gpu can load them (Windows)."""
    global _path_bootstrapped
    if _path_bootstrapped:
        return
    _path_bootstrapped = True
    if sys.platform != "win32":
        return
    try:
        import torch

        torch_lib = Path(torch.__file__).resolve().parent / "lib"
        if torch_lib.is_dir():
            current = os.environ.get("PATH", "")
            prefix = str(torch_lib)
            if prefix.lower() not in current.lower():
                os.environ["PATH"] = prefix + os.pathsep + current
                logger.debug("Prepended Torch CUDA libs to PATH: %s", torch_lib)
    except Exception as exc:
        logger.debug("Could not bootstrap Torch CUDA PATH: %s", exc)


def _onnx_providers() -> list[str]:
    _ensure_torch_cuda_dlls()
    try:
        import onnxruntime as ort

        return list(ort.get_available_providers())
    except Exception:
        return []


def _get_reader():
    global _reader
    if _reader is None:
        from rapidocr import RapidOCR

        want_cuda = ocr_use_gpu()
        torch_device = resolve_torch_device()
        providers = _onnx_providers()
        cuda_listed = "CUDAExecutionProvider" in providers
        coreml_listed = "CoreMLExecutionProvider" in providers
        params: dict = {}
        accel = "CPU"

        if want_cuda and cuda_listed:
            params["EngineConfig.onnxruntime.use_cuda"] = True
            accel = "CUDA"
        elif want_cuda and not cuda_listed:
            # NVIDIA Torch present but ORT-GPU missing/mismatched — quiet fallback.
            logger.info(
                "OCR using CPU (onnxruntime CUDA provider unavailable). "
                "On Windows with an NVIDIA GPU, install onnxruntime-gpu==1.20.2."
            )
        elif sys.platform == "darwin" and coreml_listed:
            params["EngineConfig.onnxruntime.use_coreml"] = True
            accel = "CoreML"
        elif torch_device == "mps":
            # Apple GPU accelerates SigLIP; OCR stays on CPU/CoreML (no CUDA on Mac).
            accel = "CPU (SigLIP uses Apple Metal)"

        logger.info(
            "Initializing RapidOCR / PaddleOCR (%s, torch=%s) providers=%s",
            accel,
            device_label(torch_device),
            providers or ["unknown"],
        )

        _reader = RapidOCR(params=params) if params else RapidOCR()
        if OCR_LANGUAGES != ["en"]:
            logger.info("OCR languages configured: %s", ",".join(OCR_LANGUAGES))
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
    result = reader(str(image_path))
    if result is None or not result.txts:
        return ""
    return " ".join(result.txts)


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
