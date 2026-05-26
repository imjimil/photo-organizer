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
    similarity: float | None = None
    match_kind: str = "similar"


class SearchPlanSummary(BaseModel):
    raw: str = ""
    vibe_text: str = ""
    exact_phrases: list[str] = Field(default_factory=list)
    include_words: list[str] = Field(default_factory=list)
    exclude_words: list[str] = Field(default_factory=list)
    include_folders: list[str] = Field(default_factory=list)
    exclude_folders: list[str] = Field(default_factory=list)
    has_text: bool | None = None
    date_after: str | None = None
    date_before: str | None = None
    match: str = "balanced"
    mode: str = "vibe"


class SearchResponse(BaseModel):
    query: str
    plan: SearchPlanSummary
    results: list[SearchResult]
    total: int


class SearchHistoryEntry(BaseModel):
    query: str
    plan: SearchPlanSummary
    searched_at: str


class SearchHistoryResponse(BaseModel):
    items: list[SearchHistoryEntry]


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
    absolute_path: str | None = None


class SimilarResponse(BaseModel):
    source_id: str
    results: list[SearchResult]


class SourceSummary(BaseModel):
    id: str
    name: str
    path: str
    count: int
    browse_count: int = 0
    active: bool = True
    enabled: bool = True
    removed: bool = False
    last_scan_at: str | None = None
    indexing_phase: str | None = None


class SourceCreateRequest(BaseModel):
    path: str
    name: str | None = None


class SourceUpdateRequest(BaseModel):
    name: str | None = None
    enabled: bool | None = None


class IndexStatusResponse(BaseModel):
    running: bool
    phase: str
    source_id: str | None = None
    current: int = 0
    total: int = 0
    percent: float = 0.0
    eta_seconds: int | None = None
    rate_per_second: float = 0.0
    message: str = ""
    error: str | None = None
    counts: dict[str, int] = Field(default_factory=dict)
    search_ready_percent: float = 0.0
    browse_ready: int = 0


class SourcesResponse(BaseModel):
    sources: list[SourceSummary]


class CollectionSummary(BaseModel):
    id: str
    name: str
    count: int


class CollectionsResponse(BaseModel):
    collections: list[CollectionSummary]


class AlbumSummary(BaseModel):
    id: str
    name: str
    count: int
    cover_photo_id: str | None = None
    thumb_url: str | None = None
    created_at: str
    updated_at: str
    is_system: bool = False


class FavoriteStatusResponse(BaseModel):
    favorited: bool
    album_id: str


class AlbumsResponse(BaseModel):
    albums: list[AlbumSummary]


class AlbumCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class AlbumUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    cover_photo_id: str | None = None


class AlbumPhotoRequest(BaseModel):
    photo_id: str


class AlbumReorderRequest(BaseModel):
    album_ids: list[str] = Field(..., min_length=0)


class DiscoverResponse(BaseModel):
    items: list[ImageSummary]
