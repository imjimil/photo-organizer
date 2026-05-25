import { useCallback, useEffect, useState } from 'react'
import {
  getCollections,
  getStats,
  search,
  type CollectionSummary,
  type SearchFilters,
  type SearchResult,
} from './api/client'
import { BottomNav } from './components/BottomNav'
import { Lightbox } from './components/Lightbox'
import { PhotoGrid } from './components/PhotoGrid'
import { SearchView } from './components/SearchView'
import {
  CollectionsStrip,
  MobileHeader,
  TopNav,
  type AppView,
} from './components/TopNav'
import { useBrowseFeed } from './hooks/useBrowseFeed'
import { useTheme } from './hooks/useTheme'

const defaultFilters: SearchFilters = {
  hasText: 'all',
  folder: '',
  minSimilarity: 0,
}

export default function App() {
  const { mode: themeMode, cycle: cycleTheme } = useTheme()
  const [view, setView] = useState<AppView>('library')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [statsTotal, setStatsTotal] = useState(0)
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [feedSort, setFeedSort] = useState<'date' | 'random'>('date')

  const { items, loading, hasMore, loadMore, total } = useBrowseFeed(
    feedSort,
    activeCollection,
  )

  useEffect(() => {
    getStats()
      .then((s) => setStatsTotal(s.browse_ready))
      .catch(() => {})
    getCollections()
      .then((r) => setCollections(r.collections))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        setView('search')
        requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('input[type=search]')?.focus()
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const data = await search(query.trim(), 48, filters)
      setSearchResults(data.results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [query, filters])

  const displayTotal = activeCollection
    ? collections.find((c) => c.id === activeCollection)?.count ?? total
    : total || statsTotal

  const collectionName = activeCollection
    ? collections.find((c) => c.id === activeCollection)?.name
    : undefined

  return (
    <div className="app-shell min-h-dvh bg-bg-base text-text-primary">
      <div className="ambient-wash" aria-hidden />

      <div className="relative z-10 flex min-h-dvh flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <TopNav
          view={view}
          onViewChange={setView}
          total={statsTotal || total}
          themeMode={themeMode}
          onThemeCycle={cycleTheme}
          sort={feedSort}
          onSortChange={setFeedSort}
          showSort={view === 'library'}
        />
        <MobileHeader
          view={view}
          total={displayTotal}
          themeMode={themeMode}
          onThemeCycle={cycleTheme}
          collectionName={collectionName}
        />

        {view === 'library' && (
          <div key="library" className="view-enter flex flex-1 flex-col">
            <CollectionsStrip
              collections={collections}
              activeId={activeCollection}
              onSelect={setActiveCollection}
            />
            <main className="mx-auto w-full max-w-[1680px] flex-1 px-2 pb-8 md:px-6 md:pb-12">
              <PhotoGrid
                items={items}
                onSelect={(item) => setSelectedId(item.id)}
                onLoadMore={loadMore}
                hasMore={hasMore}
                loading={loading}
              />
            </main>
          </div>
        )}

        {view === 'search' && (
          <div key="search" className="view-enter flex flex-1 flex-col">
            <SearchView
              query={query}
              onQueryChange={setQuery}
              onSearch={runSearch}
              searching={searching}
              filters={filters}
              onFiltersChange={setFilters}
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters((v) => !v)}
            />
            <main className="mx-auto w-full max-w-[1680px] flex-1 px-2 pb-8 md:px-6">
              {searching && (
                <p className="type-eyebrow pulse-soft py-16 text-center">
                  Searching
                </p>
              )}
              {!searching && searchResults.length === 0 && query.trim() && (
                <p className="type-quote mx-auto max-w-md px-4 py-20 text-center text-text-muted">
                  Nothing matched. Try a softer phrase or different filters.
                </p>
              )}
              {!searching && searchResults.length === 0 && !query.trim() && (
                <p className="type-eyebrow mx-auto max-w-sm px-4 py-20 text-center">
                  Search by mood, color, or remembered words
                </p>
              )}
              {!searching && searchResults.length > 0 && (
                <PhotoGrid
                  items={searchResults}
                  onSelect={(item) => setSelectedId(item.id)}
                  showSimilarity
                />
              )}
            </main>
          </div>
        )}

        <BottomNav view={view} onViewChange={setView} />
      </div>

      {selectedId && (
        <Lightbox
          imageId={selectedId}
          imageIds={
            view === 'library'
              ? items.map((item) => item.id)
              : searchResults.map((item) => item.id)
          }
          onClose={() => setSelectedId(null)}
          onSelect={setSelectedId}
        />
      )}
    </div>
  )
}
