import { useCallback, useEffect, useState } from 'react'
import {
  createAlbum,
  getAlbums,
  getCollections,
  getStats,
  reorderAlbums,
  search,
  type AlbumSummary,
  type CollectionSummary,
  type SearchFilters,
  type SearchResult,
} from './api/client'
import { AlbumPicker } from './components/AlbumPicker'
import { AlbumSheet } from './components/AlbumSheet'
import { BottomNav } from './components/BottomNav'
import { CollectionDetailHeader } from './components/CollectionDetailHeader'
import { CollectionsView } from './components/CollectionsView'
import {
  defaultCollectionScope,
  type CollectionScope,
} from './components/LibraryBar'
import { DiscoverView } from './components/DiscoverView'
import { Lightbox } from './components/Lightbox'
import { PhotoGrid } from './components/PhotoGrid'
import { SearchView } from './components/SearchView'
import { SelectionBar } from './components/SelectionBar'
import { MobileHeader, TopNav, type AppView } from './components/TopNav'
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
  const [collectionScope, setCollectionScope] = useState<CollectionScope>(defaultCollectionScope)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [discoverIds, setDiscoverIds] = useState<string[]>([])
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [statsTotal, setStatsTotal] = useState(0)
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [albums, setAlbums] = useState<AlbumSummary[]>([])
  const [feedSort, setFeedSort] = useState<'date' | 'random'>('date')
  const [managingAlbum, setManagingAlbum] = useState<AlbumSummary | null>(null)
  const [newAlbumOpen, setNewAlbumOpen] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAlbumOpen, setBulkAlbumOpen] = useState(false)

  const inCollectionDetail = collectionScope.kind !== 'grid'

  const collectionBrowseOptions =
    collectionScope.kind === 'album'
      ? { album: collectionScope.id }
      : collectionScope.kind === 'folder'
        ? { folder: collectionScope.id }
        : {}

  const {
    items: libraryItems,
    loading: libraryLoading,
    hasMore: libraryHasMore,
    loadMore: loadMoreLibrary,
    total: libraryTotal,
  } = useBrowseFeed(feedSort, {})

  const {
    items: collectionItems,
    loading: collectionLoading,
    hasMore: collectionHasMore,
    loadMore: loadMoreCollection,
    total: collectionTotal,
  } = useBrowseFeed(feedSort, collectionBrowseOptions, view === 'collections' && inCollectionDetail)

  const activeGridItems = view === 'collections' && inCollectionDetail ? collectionItems : libraryItems

  const refreshAlbums = useCallback(() => {
    getAlbums()
      .then((r) => setAlbums(r.albums))
      .catch(() => {})
  }, [])

  const handleReorderAlbums = useCallback(async (albumIds: string[]) => {
    await reorderAlbums(albumIds)
    refreshAlbums()
  }, [refreshAlbums])

  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBulkAlbumOpen(false)
  }, [])

  useEffect(() => {
    getStats()
      .then((s) => setStatsTotal(s.browse_ready))
      .catch(() => {})
    getCollections()
      .then((r) => setCollections(r.collections))
      .catch(() => {})
    refreshAlbums()
  }, [refreshAlbums])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        setView('search')
        requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('input[type=search]')?.focus()
        })
      }
      if (e.key === 'Escape' && selectionMode) {
        exitSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectionMode, exitSelection])

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectId = useCallback((id: string) => {
    setSelectionMode(true)
    setSelectedIds((prev) => new Set(prev).add(id))
  }, [])

  const deselectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const beginSelection = (id: string) => {
    setSelectionMode(true)
    setSelectedIds((prev) => new Set(prev).add(id))
  }

  const selectAllVisible = () => {
    setSelectionMode(true)
    setSelectedIds(new Set(activeGridItems.map((item) => item.id)))
  }

  const enterSelectionMode = () => {
    setSelectionMode(true)
    setSelectedIds(new Set())
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleGridMainClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!selectionMode) return
    const target = e.target as HTMLElement
    if (
      target.closest('.photo-tile-wrap') ||
      target.closest('.photo-grid') ||
      target.closest('.selection-bar-wrap')
    ) {
      return
    }
    exitSelection()
  }

  const handleViewChange = (next: AppView) => {
    if (next !== view) exitSelection()
    setView(next)
    if (next !== 'collections') setCollectionScope(defaultCollectionScope)
  }

  const handleCollectionBack = () => {
    setCollectionScope(defaultCollectionScope)
    exitSelection()
  }

  const handleOpenAlbum = (album: AlbumSummary) => {
    setCollectionScope({ kind: 'album', id: album.id, name: album.name })
    setView('collections')
  }

  const handleOpenFolder = (folder: CollectionSummary) => {
    setCollectionScope({ kind: 'folder', id: folder.id, name: folder.name })
    setView('collections')
  }

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newAlbumName.trim()
    if (!name) return
    try {
      const album = await createAlbum(name)
      setNewAlbumName('')
      setNewAlbumOpen(false)
      refreshAlbums()
      handleOpenAlbum(album)
    } catch {
      /* ignore */
    }
  }

  const collectionDetailCount =
    collectionScope.kind === 'album'
      ? albums.find((a) => a.id === collectionScope.id)?.count ?? collectionTotal
      : collectionScope.kind === 'folder'
        ? collections.find((c) => c.id === collectionScope.id)?.count ?? collectionTotal
        : collectionTotal

  const mobileHeaderTotal =
    view === 'collections' && inCollectionDetail
      ? collectionDetailCount
      : libraryTotal || statsTotal

  const mobileDrillIn =
    view === 'collections' && inCollectionDetail
      ? { title: collectionScope.name, onBack: handleCollectionBack }
      : undefined

  const emptyCollection =
    view === 'collections' &&
    inCollectionDetail &&
    collectionScope.kind === 'album' &&
    !collectionLoading &&
    collectionItems.length === 0

  const searchStatus = searching
    ? 'Searching'
    : view === 'search' && query.trim() && searchResults.length > 0
      ? `${searchResults.length} results`
      : view === 'search' && query.trim() && searchResults.length === 0
        ? 'No results'
        : ''

  const lightboxIds =
    view === 'library'
      ? libraryItems.map((item) => item.id)
      : view === 'collections' && inCollectionDetail
        ? collectionItems.map((item) => item.id)
        : view === 'discover'
          ? discoverIds.length > 0
            ? discoverIds
            : selectedId
              ? [selectedId]
              : []
          : searchResults.map((item) => item.id)

  const selectedCount = selectedIds.size
  const showGridSelection =
    selectionMode && (view === 'library' || (view === 'collections' && inCollectionDetail))
  const hideBottomNav = showGridSelection

  return (
    <div className="app-shell min-h-dvh bg-bg-base text-text-primary">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="ambient-wash" aria-hidden />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {searchStatus}
      </p>

      <div className="relative z-10 flex min-h-dvh flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <TopNav
          view={view}
          onViewChange={handleViewChange}
          total={statsTotal || libraryTotal}
          themeMode={themeMode}
          onThemeCycle={cycleTheme}
          sort={feedSort}
          onSortChange={setFeedSort}
          showSort={view === 'library'}
          selectionMode={selectionMode}
          onEnterSelection={
            view === 'library' || (view === 'collections' && inCollectionDetail)
              ? enterSelectionMode
              : undefined
          }
        />
        <MobileHeader
          view={view}
          total={mobileHeaderTotal}
          themeMode={themeMode}
          onThemeCycle={cycleTheme}
          drillIn={mobileDrillIn}
        />

        {view === 'library' && (
          <div key="library" className="view-enter flex flex-1 flex-col">
            {selectionMode && (
              <button
                type="button"
                className="selection-backdrop"
                aria-label="Cancel selection"
                tabIndex={-1}
              />
            )}
            {showGridSelection && (
              <SelectionBar
                count={selectedCount}
                total={activeGridItems.length}
                onDone={exitSelection}
                onAddToAlbum={() => setBulkAlbumOpen(true)}
                onSelectAll={selectAllVisible}
                onClear={clearSelection}
              />
            )}
            <main
              id="main-content"
              className="mx-auto w-full max-w-[1680px] flex-1 px-2 pb-8 md:px-6 md:pb-12"
              onClick={handleGridMainClick}
            >
              <PhotoGrid
                items={libraryItems}
                onSelect={(item) => {
                  if (!selectionMode) setSelectedId(item.id)
                }}
                onLoadMore={loadMoreLibrary}
                hasMore={libraryHasMore}
                loading={libraryLoading}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onBeginSelection={beginSelection}
                onSelectId={selectId}
                onDeselectId={deselectId}
                selectable
              />
            </main>
          </div>
        )}

        {view === 'collections' && (
          <div key="collections" className="view-enter flex flex-1 flex-col">
            {selectionMode && inCollectionDetail && (
              <button
                type="button"
                className="selection-backdrop"
                aria-label="Cancel selection"
                tabIndex={-1}
              />
            )}
            {inCollectionDetail && !selectionMode && (
              <CollectionDetailHeader
                name={collectionScope.name}
                count={collectionDetailCount}
                onBack={handleCollectionBack}
              />
            )}
            {showGridSelection && inCollectionDetail && (
              <SelectionBar
                count={selectedCount}
                total={activeGridItems.length}
                onDone={exitSelection}
                onAddToAlbum={() => setBulkAlbumOpen(true)}
                onSelectAll={selectAllVisible}
                onClear={clearSelection}
              />
            )}
            <main
              id="main-content"
              className={`mx-auto w-full max-w-[1680px] flex-1 pb-8 md:pb-12 ${
                inCollectionDetail ? 'px-2 md:px-6' : 'px-4 md:px-8'
              }`}
              onClick={inCollectionDetail ? handleGridMainClick : undefined}
            >
              {!inCollectionDetail ? (
                <CollectionsView
                  albums={albums}
                  folders={collections}
                  onOpenAlbum={handleOpenAlbum}
                  onOpenFolder={handleOpenFolder}
                  onNewAlbum={() => setNewAlbumOpen(true)}
                  onManageAlbum={setManagingAlbum}
                  onReorderAlbums={handleReorderAlbums}
                />
              ) : emptyCollection ? (
                <p className="type-quote mx-auto max-w-md px-4 py-20 text-center text-text-muted">
                  This album is empty. Select photos from your library and add them here.
                </p>
              ) : (
                <PhotoGrid
                  items={collectionItems}
                  onSelect={(item) => {
                    if (!selectionMode) setSelectedId(item.id)
                  }}
                  onLoadMore={loadMoreCollection}
                  hasMore={collectionHasMore}
                  loading={collectionLoading}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onBeginSelection={beginSelection}
                  onSelectId={selectId}
                  onDeselectId={deselectId}
                  selectable
                />
              )}
            </main>
          </div>
        )}

        {view === 'discover' && (
          <div key="discover" className="view-enter flex flex-1 flex-col">
            <DiscoverView
              onOpen={(id) => {
                setDiscoverIds([id])
                setSelectedId(id)
              }}
            />
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
            <main id="main-content" className="mx-auto w-full max-w-[1680px] flex-1 px-2 pb-8 md:px-6">
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

        <BottomNav view={view} onViewChange={handleViewChange} hidden={hideBottomNav} />
      </div>

      {newAlbumOpen && (
        <div className="sheet-scrim" onClick={() => setNewAlbumOpen(false)} role="presentation">
          <div
            className="album-sheet sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-label="New album"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sheet-header">
              <p className="type-heading text-text-primary">New album</p>
            </header>
            <form onSubmit={handleCreateAlbum} className="album-picker-create px-4 pb-4">
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Album name"
                className="album-picker-input"
                maxLength={120}
                autoFocus
              />
              <div className="album-picker-create-actions mt-3">
                <button
                  type="button"
                  className="album-picker-text-btn"
                  onClick={() => setNewAlbumOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="album-picker-text-btn album-picker-text-btn-accent"
                  disabled={!newAlbumName.trim()}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {managingAlbum && (
        <AlbumSheet
          album={managingAlbum}
          onClose={() => setManagingAlbum(null)}
          onUpdated={refreshAlbums}
          onDeleted={() => {
            if (
              collectionScope.kind === 'album' &&
              collectionScope.id === managingAlbum.id
            ) {
              setCollectionScope(defaultCollectionScope)
            }
            refreshAlbums()
          }}
        />
      )}

      {bulkAlbumOpen && selectedCount > 0 && (
        <AlbumPicker
          photoIds={[...selectedIds]}
          onClose={() => setBulkAlbumOpen(false)}
          onChanged={refreshAlbums}
        />
      )}

      {selectedId && (
        <Lightbox
          imageId={selectedId}
          imageIds={lightboxIds}
          onClose={() => setSelectedId(null)}
          onSelect={setSelectedId}
          onAlbumsChanged={refreshAlbums}
        />
      )}
    </div>
  )
}
