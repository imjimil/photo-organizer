"""Batched SigLIP / CLIP image and text embedding."""

import logging
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoModel, AutoProcessor

from opal.config import CLIP_BATCH_SIZE, CLIP_MODEL, DEVICE
from opal.device import device_label, resolve_torch_device

logger = logging.getLogger("photo_organizer.embedder")

SIGLIP_TEXT_MAX_LENGTH = 64


class CLIPEmbedder:
    def __init__(self, device: str | None = None):
        self.device = resolve_torch_device(device or DEVICE or None)
        logger.info(
            "Loading embedding model %s on %s (%s)",
            CLIP_MODEL,
            self.device,
            device_label(self.device),
        )
        self.model = AutoModel.from_pretrained(CLIP_MODEL).to(self.device)
        self.processor = AutoProcessor.from_pretrained(CLIP_MODEL, use_fast=True)
        self.model.eval()
        self._siglip = "siglip" in CLIP_MODEL.lower()

    @property
    def embedding_dim(self) -> int:
        config = self.model.config
        if getattr(config, "projection_dim", None):
            return int(config.projection_dim)
        vision = getattr(config, "vision_config", None)
        if vision is not None and getattr(vision, "hidden_size", None):
            return int(vision.hidden_size)
        text = getattr(config, "text_config", None)
        if text is not None and getattr(text, "hidden_size", None):
            return int(text.hidden_size)
        return int(config.hidden_size)

    def _normalize(self, features: torch.Tensor) -> torch.Tensor:
        return features / features.norm(dim=-1, keepdim=True)

    def _embed_images_tensor(self, images: list[Image.Image]) -> torch.Tensor:
        inputs = self.processor(images=images, return_tensors="pt").to(self.device)
        with torch.no_grad():
            features = self.model.get_image_features(**inputs)
            features = self._normalize(features)
        return features

    def embed_images_batch(
        self, image_paths: list[Path], batch_size: int | None = None
    ) -> list[list[float]]:
        """Embed a list of images in batches. Returns vectors in input order."""
        batch_size = batch_size or CLIP_BATCH_SIZE
        all_vectors: list[list[float]] = []

        for start in range(0, len(image_paths), batch_size):
            batch_paths = image_paths[start : start + batch_size]
            images: list[Image.Image] = []
            for path in batch_paths:
                with Image.open(path) as img:
                    images.append(img.convert("RGB"))

            features = self._embed_images_tensor(images)
            for vec in features.cpu().tolist():
                all_vectors.append(vec)

            if self.device == "mps":
                torch.mps.empty_cache()

        return all_vectors

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text query."""
        if self._siglip:
            inputs = self.processor(
                text=[text],
                return_tensors="pt",
                padding="max_length",
                max_length=SIGLIP_TEXT_MAX_LENGTH,
                truncation=True,
            ).to(self.device)
        else:
            inputs = self.processor(
                text=[text], return_tensors="pt", padding=True, truncation=True
            ).to(self.device)
        with torch.no_grad():
            features = self.model.get_text_features(**inputs)
            features = self._normalize(features)
        return features.flatten().cpu().tolist()
