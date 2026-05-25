"""Pydantic models for Opal API."""

from pydantic import BaseModel, Field


class StatsResponse(BaseModel):
    total_manifest: int
    chroma_vectors: int
    browse_ready: int
    status_breakdown: dict[str, int]


class ImageSummary(BaseModel):
    id: str
    content_hash: str
    rel_path: str
    has_text: bool
    ocr_preview: str
    exif_date: str | None
    thumb_url: str


class BrowseResponse(BaseModel):
    items: list[ImageSummary]
    offset: int
    limit: int
    total: int
    has_more: bool


class SearchResult(ImageSummary):
    similarity: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    total: int


class ImageDetail(BaseModel):
    id: str
    content_hash: str
    rel_path: str
    has_text: bool
    ocr_text: str
    exif_date: str | None
    status: str
    thumb_url: str
    media_url: str


class SimilarResponse(BaseModel):
    source_id: str
    results: list[SearchResult]


class SourceSummary(BaseModel):
    id: str
    name: str
    count: int
    active: bool = True


class SourcesResponse(BaseModel):
    sources: list[SourceSummary]


class CollectionSummary(BaseModel):
    id: str
    name: str
    count: int


class CollectionsResponse(BaseModel):
    collections: list[CollectionSummary]
