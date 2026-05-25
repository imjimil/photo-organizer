export interface ImageSummary {
  id: string
  content_hash: string
  rel_path: string
  has_text: boolean
  ocr_preview: string
  exif_date: string | null
  thumb_url: string
}

export interface SearchResult extends ImageSummary {
  similarity: number
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
  results: SearchResult[]
  total: number
}

export interface ImageDetail extends ImageSummary {
  ocr_text: string
  status: string
  media_url: string
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
  count: number
  active: boolean
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

export interface SearchFilters {
  hasText: 'all' | 'yes' | 'no'
  folder: string
  minSimilarity: number
}

const BASE = '/api'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${url}`)
  }
  return res.json() as Promise<T>
}

export function browse(
  offset: number,
  limit = 40,
  sort = 'date',
  folder?: string,
) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    sort,
  })
  if (folder) params.set('folder', folder)
  return fetchJson<BrowseResponse>(`${BASE}/browse?${params}`)
}

export function search(
  q: string,
  limit = 24,
  filters?: Partial<SearchFilters>,
) {
  const params = new URLSearchParams({ q, limit: String(limit) })
  if (filters?.hasText === 'yes') params.set('has_text', 'true')
  if (filters?.hasText === 'no') params.set('has_text', 'false')
  if (filters?.folder) params.set('folder', filters.folder)
  if (filters?.minSimilarity && filters.minSimilarity > 0) {
    params.set('min_similarity', String(filters.minSimilarity))
  }
  return fetchJson<SearchResponse>(`${BASE}/search?${params}`)
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

export function getSources() {
  return fetchJson<SourcesResponse>(`${BASE}/sources`)
}

export function getCollections() {
  return fetchJson<CollectionsResponse>(`${BASE}/collections`)
}

export function thumbUrl(id: string) {
  return `${BASE}/thumbs/${id}`
}

export function mediaUrl(id: string) {
  return `${BASE}/media/${id}`
}
