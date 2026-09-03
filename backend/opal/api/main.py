"""Opal FastAPI application."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import sqlite3

from opal.api.deps import get_chroma, get_embedder, get_manifest, record_to_summary
from opal.api.schemas import (
    AlbumCreateRequest,
    AlbumPhotoRequest,
    AlbumReorderRequest,
    AlbumsResponse,
    AlbumSummary,
    AlbumUpdateRequest,
    BrowseResponse,
    CollectionSummary,
    CollectionsResponse,
    DiscoverResponse,
    FavoriteStatusResponse,
    ImageDetail,
    ImageSummary,
    IndexStatusResponse,
    SearchHistoryResponse,
    SearchPlanSummary,
    SearchResponse,
    SearchResult,
    SimilarResponse,
    SourceCreateRequest,
    SourceSummary,
    SourceUpdateRequest,
    SourcesResponse,
    StatsResponse,
)
from opal.config import CLIP_BATCH_SIZE, IMAGE_FOLDER, setup_logging
from opal.device import device_label, resolve_torch_device
from opal.folder_watcher import get_folder_watcher
from opal.index_service import get_index_service
from opal.manifest import path_id
from opal.search import MatchLevel, execute_search, merge_plan, parse_search
from opal.thumbnails import get_display_image

setup_logging()
logger = logging.getLogger("photo_organizer.api")

_torch_device = resolve_torch_device()
logger.info(
    "Compute device: %s (%s), CLIP batch size %d",
    _torch_device,
    device_label(_torch_device),
    CLIP_BATCH_SIZE,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    watcher = get_folder_watcher()
    watcher.start()
    try:
        yield
    finally:
        watcher.stop()


app = FastAPI(title="Opal Gallery API", version="1.0.0", lifespan=lifespan)

_cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://tauri.localhost",
    "https://tauri.localhost",
]

if os.getenv("OPAL_DESKTOP") == "1":
    _cors_origins.append("tauri://localhost")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_record_by_path_id(path_id_str: str):
    return get_manifest().get_by_path_id(path_id_str)


def _record_root(record):
    manifest = get_manifest()
    root = manifest.get_source_root(record.source_id)
    return root or IMAGE_FOLDER


def _album_to_summary(album) -> AlbumSummary:
    thumb = None
    if album.cover_photo_id:
        thumb = f"/api/thumbs/{album.cover_photo_id}"
    return AlbumSummary(
        id=album.id,
        name=album.name,
        count=album.count,
        cover_photo_id=album.cover_photo_id,
        thumb_url=thumb,
        created_at=album.created_at,
        updated_at=album.updated_at,
        is_system=album.is_system,
    )


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
def sources(include_removed: bool = Query(False)):
    manifest = get_manifest()
    index = get_index_service()
    job = index.status(manifest)
    rows = manifest.list_sources(include_removed=include_removed)
    items: list[SourceSummary] = []
    for source in rows:
        phase = job["phase"] if job.get("source_id") == source.id and job.get("running") else None
        items.append(
            SourceSummary(
                id=source.id,
                name=source.name,
                path=source.path,
                count=manifest.source_photo_count(source.id),
                browse_count=manifest.source_photo_count(source.id, browse_ready_only=True),
                active=source.enabled and source.removed_at is None,
                enabled=source.enabled,
                removed=source.removed_at is not None,
                last_scan_at=source.last_scan_at,
                indexing_phase=phase,
            )
        )
    return SourcesResponse(sources=items)


@app.post("/api/sources", response_model=SourceSummary)
def create_source(body: SourceCreateRequest):
    manifest = get_manifest()
    try:
        source = manifest.add_or_restore_source(body.path, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    get_index_service().request(get_manifest(), get_chroma(), source.id)
    get_folder_watcher().refresh()
    return SourceSummary(
        id=source.id,
        name=source.name,
        path=source.path,
        count=0,
        browse_count=0,
        active=True,
        enabled=True,
        removed=False,
        last_scan_at=source.last_scan_at,
    )


@app.patch("/api/sources/{source_id}", response_model=SourceSummary)
def update_source(source_id: str, body: SourceUpdateRequest):
    manifest = get_manifest()
    updated = manifest.update_source(
        source_id, name=body.name, enabled=body.enabled
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Source not found")
    get_folder_watcher().refresh()
    return SourceSummary(
        id=updated.id,
        name=updated.name,
        path=updated.path,
        count=manifest.source_photo_count(updated.id),
        browse_count=manifest.source_photo_count(updated.id, browse_ready_only=True),
        active=updated.enabled and updated.removed_at is None,
        enabled=updated.enabled,
        removed=updated.removed_at is not None,
        last_scan_at=updated.last_scan_at,
    )


@app.delete("/api/sources/{source_id}")
def delete_source(source_id: str):
    manifest = get_manifest()
    if not manifest.soft_remove_source(source_id):
        raise HTTPException(status_code=404, detail="Source not found")
    get_folder_watcher().refresh()
    return {"status": "ok"}


@app.post("/api/sources/{source_id}/scan")
def scan_source(source_id: str):
    manifest = get_manifest()
    source = manifest.get_source(source_id)
    if not source or not source.enabled:
        raise HTTPException(status_code=404, detail="Source not found")
    started = get_index_service().request(get_manifest(), get_chroma(), source_id)
    if not started:
        # Queued behind an in-flight job — still OK for the client
        return {"status": "queued"}
    return {"status": "started"}


@app.get("/api/index/status", response_model=IndexStatusResponse)
def index_status():
    manifest = get_manifest()
    return IndexStatusResponse(**get_index_service().status(manifest))


@app.post("/api/index/start")
def index_start(source_id: str | None = Query(None)):
    started = get_index_service().request(get_manifest(), get_chroma(), source_id)
    if not started:
        return {"status": "queued"}
    return {"status": "started"}


@app.post("/api/index/cancel")
def index_cancel():
    get_index_service().cancel()
    return {"status": "ok"}


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
    source_id: str | None = None,
    album: str | None = None,
):
    manifest = get_manifest()
    if album:
        album_row = manifest.get_album(album)
        if not album_row:
            raise HTTPException(status_code=404, detail="Album not found")
        total = manifest.album_count(album)
        records = manifest.browse_album(
            album_id=album, offset=offset, limit=limit, sort=sort
        )
    else:
        total = manifest.browse_count(
            folder=folder or None, source_id=source_id or None
        )
        records = manifest.browse(
            offset=offset,
            limit=limit,
            sort=sort,
            folder=folder or None,
            source_id=source_id or None,
        )
    items = [ImageSummary(**record_to_summary(r)) for r in records]
    return BrowseResponse(
        items=items,
        offset=offset,
        limit=limit,
        total=total,
        has_more=offset + len(items) < total,
    )


@app.get("/api/albums", response_model=AlbumsResponse)
def list_albums():
    manifest = get_manifest()
    albums = manifest.list_albums()
    return AlbumsResponse(albums=[_album_to_summary(a) for a in albums])


@app.post("/api/albums", response_model=AlbumSummary, status_code=201)
def create_album(body: AlbumCreateRequest):
    manifest = get_manifest()
    try:
        album = manifest.create_album(body.name)
    except ValueError as exc:
        if "reserved" in str(exc).lower():
            raise HTTPException(status_code=409, detail="Album name reserved")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Album name already exists")
    return _album_to_summary(album)


@app.put("/api/albums/order", status_code=204)
def reorder_albums(body: AlbumReorderRequest):
    manifest = get_manifest()
    try:
        manifest.reorder_albums(body.album_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/albums/{album_id}", response_model=AlbumSummary)
def update_album(album_id: str, body: AlbumUpdateRequest):
    manifest = get_manifest()
    album = manifest.get_album(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    if album.is_system and body.name is not None and body.name.strip().casefold() != album.name.casefold():
        raise HTTPException(status_code=403, detail="System album cannot be renamed")
    try:
        if body.name is not None:
            updated = manifest.rename_album(album_id, body.name)
            if not updated:
                raise HTTPException(status_code=404, detail="Album not found")
        if body.cover_photo_id is not None:
            updated = manifest.set_album_cover(album_id, body.cover_photo_id)
            if not updated:
                raise HTTPException(status_code=404, detail="Album not found")
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Album name already exists")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    album = manifest.get_album(album_id)
    assert album is not None
    return _album_to_summary(album)


@app.delete("/api/albums/{album_id}", status_code=204)
def delete_album(album_id: str):
    manifest = get_manifest()
    if not manifest.delete_album(album_id):
        raise HTTPException(status_code=404, detail="Album not found")


@app.post("/api/albums/{album_id}/photos", status_code=204)
def add_album_photo(album_id: str, body: AlbumPhotoRequest):
    manifest = get_manifest()
    if not manifest.get_album(album_id):
        raise HTTPException(status_code=404, detail="Album not found")
    if not manifest.add_to_album(album_id, body.photo_id):
        raise HTTPException(status_code=404, detail="Photo not found")
    return None


@app.delete("/api/albums/{album_id}/photos/{photo_id}", status_code=204)
def remove_album_photo(album_id: str, photo_id: str):
    manifest = get_manifest()
    if not manifest.remove_from_album(album_id, photo_id):
        raise HTTPException(status_code=404, detail="Album or photo not found")
    return None


@app.get("/api/albums/for-photo/{photo_id}")
def albums_for_photo(photo_id: str):
    manifest = get_manifest()
    return {"album_ids": manifest.albums_for_photo(photo_id)}


@app.get("/api/favorites/{photo_id}", response_model=FavoriteStatusResponse)
def favorite_status(photo_id: str):
    manifest = get_manifest()
    return FavoriteStatusResponse(
        favorited=manifest.is_favorite(photo_id),
        album_id=manifest.favorites_album_id(),
    )


@app.post("/api/favorites/toggle", response_model=FavoriteStatusResponse)
def toggle_favorite(body: AlbumPhotoRequest):
    manifest = get_manifest()
    try:
        favorited = manifest.toggle_favorite(body.photo_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Photo not found")
    return FavoriteStatusResponse(
        favorited=favorited,
        album_id=manifest.favorites_album_id(),
    )


@app.get("/api/discover", response_model=DiscoverResponse)
def discover(
    limit: int = Query(1, ge=1, le=20),
    exclude: str | None = None,
):
    manifest = get_manifest()
    exclude_ids = [x.strip() for x in exclude.split(",") if x.strip()] if exclude else []
    records = manifest.discover_random(limit=limit, exclude=exclude_ids or None)
    items = [ImageSummary(**record_to_summary(r)) for r in records]
    return DiscoverResponse(items=items)


@app.get("/api/search", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(48, ge=1, le=100),
    match: MatchLevel | None = Query(None),
    has_text: bool | None = None,
    folder: str | None = None,
    min_similarity: float | None = Query(None, ge=0.0, le=1.0),
):
    embedder = get_embedder()
    chroma = get_chroma()
    manifest = get_manifest()

    plan = parse_search(q)
    chip_has_text = has_text
    merge_plan(plan, match=match, has_text=chip_has_text, folder=folder or None)

    if min_similarity is not None and min_similarity > 0:
        if min_similarity >= 0.4:
            plan.match = "strict"
        elif min_similarity >= 0.2:
            plan.match = "balanced"
        else:
            plan.match = "broad"

    hits = execute_search(plan, manifest, chroma, embedder, limit=limit)
    results: list[SearchResult] = []
    for record, match_kind, similarity in hits:
        summary = record_to_summary(record)
        results.append(
            SearchResult(
                **summary,
                similarity=similarity,
                match_kind=match_kind,
            )
        )

    if results:
        manifest.save_search_history(q, plan.to_summary())

    return SearchResponse(
        query=q,
        plan=SearchPlanSummary(**plan.to_summary()),
        results=results,
        total=len(results),
    )


@app.get("/api/search/history", response_model=SearchHistoryResponse)
def search_history(limit: int = Query(12, ge=1, le=50)):
    manifest = get_manifest()
    items = []
    for row in manifest.list_search_history(limit=limit):
        items.append(
            {
                "query": row["query"],
                "plan": SearchPlanSummary(**row.get("plan", {})),
                "searched_at": row["searched_at"],
            }
        )
    return SearchHistoryResponse(items=items)


@app.delete("/api/search/history")
def clear_search_history():
    get_manifest().clear_search_history()
    return {"status": "ok"}


@app.get("/api/images/{image_id}", response_model=ImageDetail)
def image_detail(image_id: str):
    record = _resolve_record_by_path_id(image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    pid = record.id
    manifest = get_manifest()
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
        absolute_path=manifest.resolve_absolute_path(record),
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
        if not rec or not manifest.record_in_active_library(rec):
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
    root = _record_root(record)
    path = get_display_image(image_id, record.rel_path, root)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    media = "image/webp" if path.suffix.lower() == ".webp" else "image/jpeg"
    return FileResponse(path, media_type=media)


@app.get("/api/export/{image_id}")
def export_image(image_id: str):
    record = _resolve_record_by_path_id(image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    full = _record_root(record) / record.rel_path
    if not full.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")
    return FileResponse(
        full,
        filename=full.name,
        media_type="application/octet-stream",
    )


@app.get("/api/media/{image_id}")
def serve_media(image_id: str):
    record = _resolve_record_by_path_id(image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    full = _record_root(record) / record.rel_path
    if not full.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")
    return FileResponse(full)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "opal"}


def main():
    import uvicorn

    uvicorn.run("opal.api.main:app", host="127.0.0.1", port=8000, reload=False)


if __name__ == "__main__":
    main()
