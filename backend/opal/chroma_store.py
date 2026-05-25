"""ChromaDB wrapper with batch upsert and hybrid query."""

import logging
from typing import Any

import chromadb

from opal.config import CHROMA_BATCH_SIZE, CHROMA_PATH, COLLECTION_NAME, ensure_dirs

logger = logging.getLogger("photo_organizer.chroma_store")


class ChromaStore:
    def __init__(self, path: str | None = None, collection_name: str | None = None):
        ensure_dirs()
        self.client = chromadb.PersistentClient(path=str(path or CHROMA_PATH))
        self.collection_name = collection_name or COLLECTION_NAME
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert_batch(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict[str, Any]],
        batch_size: int | None = None,
    ) -> int:
        """Upsert records in batches. Returns total upserted count."""
        batch_size = batch_size or CHROMA_BATCH_SIZE
        total = 0
        for start in range(0, len(ids), batch_size):
            end = start + batch_size
            self.collection.upsert(
                ids=ids[start:end],
                embeddings=embeddings[start:end],
                documents=documents[start:end],
                metadatas=metadatas[start:end],
            )
            total += end - start
            logger.debug("Upserted %d / %d to Chroma", total, len(ids))
        return total

    def delete_ids(self, ids: list[str]) -> None:
        if ids:
            self.collection.delete(ids=ids)

    def query(
        self,
        query_embedding: list[float],
        query_text: str,
        n_results: int = 12,
        where: dict | None = None,
    ) -> dict:
        kwargs: dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "query_texts": [query_text],
            "n_results": n_results,
            "include": ["metadatas", "documents", "distances"],
        }
        if where:
            kwargs["where"] = where
        return self.collection.query(**kwargs)

    def count(self) -> int:
        return self.collection.count()

    def get_all_embeddings(self) -> tuple[list[str], list[list[float]]]:
        """Fetch all ids and embeddings for duplicate detection."""
        result = self.collection.get(include=["embeddings"])
        ids = result.get("ids") or []
        embeddings = result.get("embeddings") or []
        return ids, embeddings
