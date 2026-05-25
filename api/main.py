"""Opal FastAPI application."""

import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from api.deps import get_chroma, get_embedder, get_manifest, record_to_summary
from api.schemas import (
    BrowseResponse,
    CollectionSummary,
    CollectionsResponse,
    ImageDetail,
    ImageSummary,
    SearchResponse,
    SearchResult,
    SimilarResponse,
    SourceSummary,
    SourcesResponse,
    StatsResponse,
)
from config import IMAGE_FOLDER, setup_logging
from manifest import path_id
from thumbnails import get_display_image

setup_logging()
logger = logging.getLogger("photo_organizer.api")

app = FastAPI(title="Opal Gallery API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_record_by_path_id(path_id_str: str):
    return get_manifest().get_by_path_id(path_id_str)


@app.get("/api/collections", response_model=CollectionsResponse)
def collections(limit: int = Query(24, ge=1, le=100)):
    manifest = get_manifest()
    rows = manifest.list_collections(limit=limit)
    items: list[CollectionSummary] = []
    for folder, count in rows:
        if not folder:
            continue
        items.append(
            CollectionSummary(id=folder, name=folder, count=count)
        )
    return CollectionsResponse(collections=items)


@app.get("/api/sources", response_model=SourcesResponse)
def sources():
    manifest = get_manifest()
    count = manifest.browse_count()
    return SourcesResponse(
        sources=[
            SourceSummary(
                id="default",
                name="Library",
                count=count,
                active=True,
            )
        ]
    )


@app.get("/api/stats", response_model=StatsResponse)
def stats():
    manifest = get_manifest()
    chroma = get_chroma()
    return StatsResponse(
        total_manifest=manifest.total_count(),
        chroma_vectors=chroma.count(),
        browse_ready=manifest.browse_count(),
        status_breakdown=manifest.count_by_status(),
    )


@app.get("/api/browse", response_model=BrowseResponse)
def browse(
    offset: int = Query(0, ge=0),
    limit: int = Query(40, ge=1, le=100),
    sort: str = Query("date", pattern="^(date|random)$"),
    folder: str | None = None,
):
    manifest = get_manifest()
    total = manifest.browse_count(folder=folder or None)
    records = manifest.browse(
        offset=offset, limit=limit, sort=sort, folder=folder or None
    )
    items = [ImageSummary(**record_to_summary(r)) for r in records]
    return BrowseResponse(
        items=items,
        offset=offset,
        limit=limit,
        total=total,
        has_more=offset + len(items) < total,
    )


@app.get("/api/search", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(24, ge=1, le=100),
    has_text: bool | None = None,
    folder: str | None = None,
    min_similarity: float = Query(0.0, ge=0.0, le=1.0),
):
    embedder = get_embedder()
    chroma = get_chroma()
    manifest = get_manifest()

    query_vector = embedder.embed_text(q)
    where = None
    if has_text is True:
        where = {"has_text": True}
    elif has_text is False:
        where = {"has_text": False}

    fetch_n = min(limit * 3 if (folder or min_similarity > 0) else limit, 100)
    raw = chroma.query(
        query_embedding=query_vector,
        query_text=q,
        n_results=fetch_n,
        where=where,
    )

    results: list[SearchResult] = []
    if not raw.get("metadatas") or not raw["metadatas"][0]:
        return SearchResponse(query=q, results=[], total=0)

    for idx, (cid, meta, dist) in enumerate(
        zip(
            raw["ids"][0],
            raw["metadatas"][0],
            raw.get("distances", [[]])[0],
        )
    ):
        similarity = 1.0 - dist
        if similarity < min_similarity:
            continue
        rel_path = meta.get("rel_path", "")
        if folder and folder not in rel_path:
            continue
        record = manifest.get_by_id(cid)
        if not record:
            continue
        summary = record_to_summary(record)
        results.append(SearchResult(**summary, similarity=round(similarity, 4)))
        if len(results) >= limit:
            break

    return SearchResponse(query=q, results=results, total=len(results))


@app.get("/api/images/{image_id}", response_model=ImageDetail)
def image_detail(image_id: str):
    record = _resolve_record_by_path_id(image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    pid = path_id(record.rel_path)
    return ImageDetail(
        id=pid,
        content_hash=record.content_hash,
        rel_path=record.rel_path,
        has_text=record.has_text,
        ocr_text=record.ocr_text,
        exif_date=record.exif_date,
        status=record.status,
        thumb_url=f"/api/thumbs/{pid}",
        media_url=f"/api/media/{pid}",
    )


@app.get("/api/images/{image_id}/similar", response_model=SimilarResponse)
def similar(image_id: str, limit: int = Query(12, ge=1, le=40)):
    record = _resolve_record_by_path_id(image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")

    chroma = get_chroma()
    manifest = get_manifest()
    got = chroma.collection.get(ids=[record.content_hash], include=["embeddings"])
    if not got.get("embeddings") or not got["embeddings"][0]:
        raise HTTPException(status_code=404, detail="Embedding not found")

    raw = chroma.collection.query(
        query_embeddings=[got["embeddings"][0]],
        n_results=min(limit + 1, 50),
        include=["metadatas", "distances"],
    )

    results: list[SearchResult] = []
    for cid, meta, dist in zip(
        raw["ids"][0],
        raw["metadatas"][0],
        raw.get("distances", [[]])[0],
    ):
        if cid == record.content_hash:
            continue
        rec = manifest.get_by_id(cid)
        if not rec:
            continue
        summary = record_to_summary(rec)
        results.append(
            SearchResult(**summary, similarity=round(1.0 - dist, 4))
        )
        if len(results) >= limit:
            break

    return SimilarResponse(source_id=image_id, results=results)


@app.get("/api/thumbs/{image_id}")
def serve_thumb(image_id: str):
    record = _resolve_record_by_path_id(image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    path = get_display_image(image_id, record.rel_path, IMAGE_FOLDER)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    media = "image/webp" if path.suffix.lower() == ".webp" else "image/jpeg"
    return FileResponse(path, media_type=media)


@app.get("/api/media/{image_id}")
def serve_media(image_id: str):
    record = _resolve_record_by_path_id(image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    full = IMAGE_FOLDER / record.rel_path
    if not full.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")
    return FileResponse(full)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "opal"}


def main():
    import uvicorn

    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=False)


if __name__ == "__main__":
    main()
