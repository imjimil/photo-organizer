"""Batched CLIP image and text embedding."""

import logging
from pathlib import Path

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from opal.config import CLIP_BATCH_SIZE, CLIP_MODEL, DEVICE
from opal.device import device_label, resolve_torch_device

logger = logging.getLogger("photo_organizer.embedder")


class CLIPEmbedder:
    def __init__(self, device: str | None = None):
        self.device = resolve_torch_device(device or DEVICE or None)
        logger.info(
            "Loading CLIP model on %s (%s)",
            self.device,
            device_label(self.device),
        )
        self.model = CLIPModel.from_pretrained(CLIP_MODEL).to(self.device)
        self.processor = CLIPProcessor.from_pretrained(CLIP_MODEL)
        self.model.eval()

    def _embed_images_tensor(self, images: list[Image.Image]) -> torch.Tensor:
        inputs = self.processor(images=images, return_tensors="pt").to(self.device)
        with torch.no_grad():
            vision_outputs = self.model.vision_model(pixel_values=inputs["pixel_values"])
            features = self.model.visual_projection(vision_outputs.pooler_output)
            features = features / features.norm(dim=-1, keepdim=True)
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
        inputs = self.processor(
            text=[text], return_tensors="pt", padding=True, truncation=True
        ).to(self.device)
        with torch.no_grad():
            text_outputs = self.model.text_model(
                input_ids=inputs["input_ids"],
                attention_mask=inputs.get("attention_mask"),
            )
            features = self.model.text_projection(text_outputs.pooler_output)
            features = features / features.norm(dim=-1, keepdim=True)
        return features.flatten().cpu().tolist()
