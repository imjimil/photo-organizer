export interface ImageSummary {
  id: string
  content_hash: string
  rel_path: string
  has_text: boolean
  ocr_preview: string
  exif_date: string | null
  thumb_url: string
  w: number | null
  h: number | null
}

export interface SearchResult extends ImageSummary {
  similarity?: number | null
  match_kind?: 'exact' | 'include' | 'similar'
}

export type MatchFeel = 'broad' | 'balanced' | 'strict'

export interface SearchPlanSummary {
  raw: string
  vibe_text: string
  exact_phrases: string[]
  include_words: string[]
  exclude_words: string[]
  include_folders: string[]
  exclude_folders: string[]
  has_text: boolean | null
  date_after: string | null
  date_before: string | null
  match: MatchFeel
  mode: string
}

export interface BrowseResponse {
  items: ImageSummary[]
  offset: number
  limit: number
  total: number
  has_more: boolean
}

export interface SearchResponse {
  query: string
  plan: SearchPlanSummary
  results: SearchResult[]
  total: number
}

export interface SearchHistoryEntry {
  query: string
  plan: SearchPlanSummary
  searched_at: string
}

export interface ImageDetail extends ImageSummary {
  ocr_text: string
  status: string
  media_url: string
  absolute_path?: string | null
}

export interface StatsResponse {
  total_manifest: number
  chroma_vectors: number
  browse_ready: number
  status_breakdown: Record<string, number>
}

export interface SourceSummary {
  id: string
  name: string
  path: string
  count: number
  browse_count: number
  active: boolean
  enabled: boolean
  removed: boolean
  last_scan_at: string | null
  indexing_phase: string | null
}

export interface IndexStatus {
  running: boolean
  phase: string
  source_id: string | null
  current: number
  total: number
  percent: number
  eta_seconds: number | null
  rate_per_second: number
  message: string
  error: string | null
  counts: Record<string, number>
  search_ready_percent: number
  browse_ready: number
}

export interface SourcesResponse {
  sources: SourceSummary[]
}

export interface CollectionSummary {
  id: string
  name: string
  count: number
}

export interface CollectionsResponse {
  collections: CollectionSummary[]
}

export interface AlbumSummary {
  id: string
  name: string
  count: number
  cover_photo_id: string | null
  thumb_url: string | null
  created_at: string
  updated_at: string
  is_system?: boolean
}

export const FAVORITES_ALBUM_ID = '00000000-0000-4000-8000-000000000001'

export interface AlbumsResponse {
  albums: AlbumSummary[]
}

export interface DiscoverResponse {
  items: ImageSummary[]
}

export interface SearchFilters {
  match: MatchFeel
  hasText: 'all' | 'yes' | 'no'
  folder: string
}

export interface BrowseOptions {
  folder?: string
  album?: string
  source_id?: string
}

const API_HOST = import.meta.env.VITE_API_HOST ?? 'http://127.0.0.1:8000'

function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export { isDesktopShell }

const BASE = isDesktopShell() ? `${API_HOST}/api` : '/api'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${url}`)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}

export function browse(
  offset: number,
  limit = 40,
  sort = 'date',
  options?: BrowseOptions,
) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    sort,
  })
  if (options?.folder) params.set('folder', options.folder)
  if (options?.album) params.set('album', options.album)
  if (options?.source_id) params.set('source_id', options.source_id)
  return fetchJson<BrowseResponse>(`${BASE}/browse?${params}`)
}

export function discover(limit = 1, exclude: string[] = []) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (exclude.length > 0) params.set('exclude', exclude.join(','))
  return fetchJson<DiscoverResponse>(`${BASE}/discover?${params}`)
}

export function search(
  q: string,
  limit = 48,
  filters?: Partial<SearchFilters>,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ q, limit: String(limit) })
  if (filters?.hasText === 'yes') params.set('has_text', 'true')
  if (filters?.hasText === 'no') params.set('has_text', 'false')
  if (filters?.folder) params.set('folder', filters.folder)
  if (filters?.match) params.set('match', filters.match)
  return fetchJson<SearchResponse>(`${BASE}/search?${params}`, { signal })
}

export function getSearchHistory(limit = 12) {
  return fetchJson<{ items: SearchHistoryEntry[] }>(
    `${BASE}/search/history?limit=${limit}`,
  )
}

export function clearSearchHistory() {
  return fetchJson<{ status: string }>(`${BASE}/search/history`, {
    method: 'DELETE',
  })
}

export function getImage(id: string) {
  return fetchJson<ImageDetail>(`${BASE}/images/${id}`)
}

export function getSimilar(id: string, limit = 12) {
  return fetchJson<{ source_id: string; results: SearchResult[] }>(
    `${BASE}/images/${id}/similar?limit=${limit}`,
  )
}

export function getStats() {
  return fetchJson<StatsResponse>(`${BASE}/stats`)
}

export function getSources(includeRemoved = false) {
  const params = includeRemoved ? '?include_removed=1' : ''
  return fetchJson<SourcesResponse>(`${BASE}/sources${params}`)
}

export function addSource(path: string, name?: string) {
  return fetchJson<SourceSummary>(`${BASE}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name }),
  })
}

export function removeSource(sourceId: string) {
  return fetchJson<{ status: string }>(`${BASE}/sources/${sourceId}`, {
    method: 'DELETE',
  })
}

export function scanSource(sourceId: string) {
  return fetchJson<{ status: string }>(`${BASE}/sources/${sourceId}/scan`, {
    method: 'POST',
  })
}

export function getIndexStatus() {
  return fetchJson<IndexStatus>(`${BASE}/index/status`)
}

export function startIndex(sourceId?: string) {
  const params = sourceId ? `?source_id=${encodeURIComponent(sourceId)}` : ''
  return fetchJson<{ status: string }>(`${BASE}/index/start${params}`, {
    method: 'POST',
  })
}

export function cancelIndex() {
  return fetchJson<{ status: string }>(`${BASE}/index/cancel`, { method: 'POST' })
}

export function getCollections() {
  return fetchJson<CollectionsResponse>(`${BASE}/collections`)
}

export function getAlbums() {
  return fetchJson<AlbumsResponse>(`${BASE}/albums`)
}

export function createAlbum(name: string) {
  return fetchJson<AlbumSummary>(`${BASE}/albums`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function renameAlbum(id: string, name: string) {
  return fetchJson<AlbumSummary>(`${BASE}/albums/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function deleteAlbum(id: string) {
  return fetchJson<void>(`${BASE}/albums/${id}`, { method: 'DELETE' })
}

export function reorderAlbums(albumIds: string[]) {
  return fetchJson<void>(`${BASE}/albums/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ album_ids: albumIds }),
  })
}

export function setAlbumCover(id: string, coverPhotoId: string | null) {
  return fetchJson<AlbumSummary>(`${BASE}/albums/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cover_photo_id: coverPhotoId }),
  })
}

export function addToAlbum(albumId: string, photoId: string) {
  return fetchJson<void>(`${BASE}/albums/${albumId}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId }),
  })
}

export function removeFromAlbum(albumId: string, photoId: string) {
  return fetchJson<void>(`${BASE}/albums/${albumId}/photos/${photoId}`, {
    method: 'DELETE',
  })
}

export function getAlbumsForPhoto(photoId: string) {
  return fetchJson<{ album_ids: string[] }>(`${BASE}/albums/for-photo/${photoId}`)
}

export function getFavoriteStatus(photoId: string) {
  return fetchJson<{ favorited: boolean; album_id: string }>(`${BASE}/favorites/${photoId}`)
}

export function toggleFavorite(photoId: string) {
  return fetchJson<{ favorited: boolean; album_id: string }>(`${BASE}/favorites/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId }),
  })
}

export function isFavoritesAlbum(album: AlbumSummary) {
  return album.is_system === true || album.id === FAVORITES_ALBUM_ID
}

export function thumbUrl(id: string) {
  return `${BASE}/thumbs/${id}`
}

export function mediaUrl(id: string) {
  return `${BASE}/media/${id}`
}

export function exportUrl(id: string) {
  return `${BASE}/export/${id}`
}
