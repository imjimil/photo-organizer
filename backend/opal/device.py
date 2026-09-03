"""PyTorch device selection for Windows (CUDA), macOS (MPS), and CPU fallback."""

from __future__ import annotations

import os
import sys

import torch

_VALID_DEVICES = frozenset({"cuda", "mps", "cpu"})


def _mps_available() -> bool:
    mps = getattr(torch.backends, "mps", None)
    return bool(mps and mps.is_available())


def resolve_torch_device(prefer: str | None = None) -> str:
    """Pick cuda, mps, or cpu. Honors DEVICE env and explicit prefer."""
    explicit = (prefer or os.getenv("DEVICE", "")).strip().lower()
    if explicit:
        if explicit not in _VALID_DEVICES:
            raise ValueError(f"Invalid DEVICE={explicit!r}; use cuda, mps, or cpu")
        if explicit == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("DEVICE=cuda but CUDA is not available")
        if explicit == "mps" and not _mps_available():
            raise RuntimeError("DEVICE=mps but MPS (Metal) is not available")
        return explicit

    if torch.cuda.is_available():
        return "cuda"
    if _mps_available():
        return "mps"
    return "cpu"


def device_label(device: str) -> str:
    labels = {
        "cuda": "NVIDIA CUDA",
        "mps": "Apple Metal (MPS)",
        "cpu": "CPU",
    }
    return labels.get(device, device)


def ocr_use_gpu() -> bool:
    """NVIDIA CUDA path for RapidOCR only. Mac uses CoreML/CPU — never CUDA."""
    return torch.cuda.is_available()


def default_clip_batch_size(device: str | None = None) -> int:
    """Conservative batch sizes to reduce OOM on MPS and CPU."""
    dev = device or resolve_torch_device()
    if dev == "cuda":
        return 16
    if dev == "mps":
        return 8
    return 4


def configure_mps_fallback() -> None:
    """Allow unsupported ops to fall back to CPU when running on MPS."""
    if sys.platform == "darwin" and os.getenv("PYTORCH_ENABLE_MPS_FALLBACK") is None:
        os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
