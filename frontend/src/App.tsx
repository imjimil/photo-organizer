import { useCallback, useEffect, useState } from 'react'
import {
  getStats,
  search,
  type ImageSummary,
  type SearchFilters,
  type SearchResult,
} from './api/client'
import { Header } from './components/Header'
import { Lightbox } from './components/Lightbox'
import { MasonryGrid } from './components/MasonryGrid'
import { useBrowseFeed } from './hooks/useBrowseFeed'

const defaultFilters: SearchFilters = {
  hasText: 'all',
  folder: '',
  minSimilarity: 0,
}

export default function App() {
  const [mode, setMode] = useState<'feed' | 'search'>('feed')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [statsTotal, setStatsTotal] = useState(0)
  const [feedSort, setFeedSort] = useState<'date' | 'random'>('date')

  const { items, loading, hasMore, loadMore, total } =
    useBrowseFeed(feedSort)

  useEffect(() => {
    getStats()
      .then((s) => setStatsTotal(s.browse_ready))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[type=search]')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const runSearch = useCallback(async () => {
    if (!query.trim()) {
      setMode('feed')
      return
    }
    setMode('search')
    setSearching(true)
    try {
      const data = await search(query.trim(), 24, filters)
      setSearchResults(data.results)
    } catch (err) {
      console.error(err)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [query, filters])

  const handleSelect = (item: ImageSummary | SearchResult) => {
    setSelectedId(item.id)
  }

  const displayTotal = mode === 'feed' ? total || statsTotal : statsTotal

  return (
    <div className="min-h-dvh bg-bg-base text-text-primary">
      <Header
        query={query}
        onQueryChange={setQuery}
        onSearch={runSearch}
        mode={mode}
        onModeChange={(m) => {
          setMode(m)
          if (m === 'feed') setSearchResults([])
        }}
        total={displayTotal}
        filters={filters}
        onFiltersChange={setFilters}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
        {mode === 'feed' && (
          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFeedSort('date')}
              className={`rounded-md px-3 py-1 text-sm ${
                feedSort === 'date'
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-muted'
              }`}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setFeedSort('random')}
              className={`rounded-md px-3 py-1 text-sm ${
                feedSort === 'random'
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-muted'
              }`}
            >
              Shuffle
            </button>
          </div>
        )}

        {mode === 'search' && searching && (
          <p className="py-16 text-center font-mono text-sm text-text-faint">
            Searching…
          </p>
        )}

        {mode === 'search' && !searching && searchResults.length === 0 && query && (
          <p className="py-16 text-center font-quote text-lg text-text-muted">
            Nothing matched. Try a mood, a phrase, or loosen the filters.
          </p>
        )}

        {mode === 'feed' && (
          <MasonryGrid
            items={items}
            onSelect={handleSelect}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loading={loading}
          />
        )}

        {mode === 'search' && !searching && searchResults.length > 0 && (
          <MasonryGrid
            items={searchResults}
            onSelect={handleSelect}
            showSimilarity
          />
        )}
      </main>

      {selectedId && (
        <Lightbox
          imageId={selectedId}
          onClose={() => setSelectedId(null)}
          onSelect={setSelectedId}
        />
      )}
    </div>
  )
}
