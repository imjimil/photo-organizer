"""Shared dependencies — lazy CLIP load for GPU efficiency."""

from functools import lru_cache

from opal.chroma_store import ChromaStore
from opal.embedder import CLIPEmbedder
from opal.manifest import Manifest, PhotoRecord, path_id


@lru_cache
def get_manifest() -> Manifest:
    return Manifest()


@lru_cache
def get_chroma() -> ChromaStore:
    return ChromaStore()


_embedder: CLIPEmbedder | None = None


def get_embedder() -> CLIPEmbedder:
    global _embedder
    if _embedder is None:
        _embedder = CLIPEmbedder()
    return _embedder


def record_to_summary(record: PhotoRecord) -> dict:
    pid = record.id
    preview = record.ocr_text.strip().replace("\n", " ")
    if len(preview) > 140:
        preview = preview[:137] + "..."
    return {
        "id": pid,
        "content_hash": record.content_hash,
        "rel_path": record.rel_path,
        "has_text": record.has_text,
        "ocr_preview": preview,
        "exif_date": record.exif_date,
        "thumb_url": f"/api/thumbs/{pid}",
    }
