import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createAlbum,
  getAlbums,
  getCollections,
  getStats,
  isDesktopShell,
  reorderAlbums,
  search,
  thumbUrl,
  type AlbumSummary,
  type CollectionSummary,
  type SearchPlanSummary,
  type SearchResult,
  type SourceSummary,
} from './api/client'
import { AlbumPicker } from './components/AlbumPicker'
import { NewAlbumSheet } from './components/NewAlbumSheet'
import { AlbumSheet } from './components/AlbumSheet'
import { BottomNav } from './components/BottomNav'
import { CollectionDetailHeader } from './components/CollectionDetailHeader'
import { CollectionsView } from './components/CollectionsView'
import { ContextHint } from './components/ContextHint'
import { OnboardingView } from './components/OnboardingView'
import { IndexProgressBanner } from './components/IndexProgressBanner'
import { SourcesSettings } from './components/SourcesSettings'
import { DiscoverView } from './components/DiscoverView'
import { Lightbox } from './components/Lightbox'
import { PhotoGrid } from './components/PhotoGrid'
import { SearchView } from './components/SearchView'
import { SelectionBar } from './components/SelectionBar'
import { EdgeRail, type AppView } from './components/EdgeRail'
import { LibraryToolbar } from './components/LibraryToolbar'
import { MobileHeader } from './components/MobileHeader'
import { Titlebar } from './components/Titlebar'
import {
  defaultCollectionScope,
  type CollectionScope,
} from './components/LibraryBar'
import { useBrowseFeed } from './hooks/useBrowseFeed'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useDismissibleHint } from './hooks/useDismissibleHint'
import { useTheme } from './hooks/useTheme'
import { useToast } from './hooks/useToast'
import { useSearchHistory } from './hooks/useSearchHistory'
import { useIndexJob } from './hooks/useIndexJob'
import { useSources } from './hooks/useSources'
import { formatSourcesLabel } from './utils/sourcesLabel'
import { LibraryEmpty } from './components/LibraryEmpty'
import {
  apiSearchQuery,
  chipsAreActive,
  chipsFromPlan,
  defaultChipState,
  type SearchChipState,
} from './search/plan'

const ONBOARDING_SKIP_KEY = 'opal-onboarding-skipped'

export default function App() {
  const desktop = isDesktopShell()
  const { toast } = useToast()
  const { mode: themeMode, cycle: cycleTheme } = useTheme()
  const selectHint = useDismissibleHint('opal-hint-select')
  const searchHint = useDismissibleHint('opal-hint-search')
  const searchAbortRef = useRef<AbortController | null>(null)
  const { items: searchHistory, record: recordSearchHistory, clear: clearSearchHistory } =
    useSearchHistory()
  const [view, setView] = useState<AppView>('search')
  const [collectionScope, setCollectionScope] = useState<CollectionScope>(defaultCollectionScope)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 400)
  const [chips, setChips] = useState<SearchChipState>(defaultChipState)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchPlan, setSearchPlan] = useState<SearchPlanSummary | null>(null)
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [discoverIds, setDiscoverIds] = useState<string[]>([])
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [onboardingSkipped, setOnboardingSkipped] = useState(
    () => localStorage.getItem(ONBOARDING_SKIP_KEY) === '1',
  )

  const {
    sources,
    activeSources,
    loading: sourcesLoading,
    pickAndAdd,
    remove: removeSource,
    rescan,
    refresh: refreshSources,
    hasSources,
  } = useSources()
  const sourcesLabel = formatSourcesLabel(activeSources)
  const openSources = useCallback(() => setSettingsOpen(true), [])
  const { status: indexStatus, searchPartial } = useIndexJob()

  const showOnboarding =
    desktop &&
    !sourcesLoading &&
    !hasSources &&
    !onboardingSkipped &&
    !onboardingDone

  const inCollectionDetail = collectionScope.kind !== 'grid'

  const collectionBrowseOptions =
    collectionScope.kind === 'album'
      ? { album: collectionScope.id }
      : collectionScope.kind === 'folder'
        ? { folder: collectionScope.id }
        : collectionScope.kind === 'source'
          ? { source_id: collectionScope.id }
          : {}

  const {
    items: libraryItems,
    loading: libraryLoading,
    error: libraryError,
    hasMore: libraryHasMore,
    loadMore: loadMoreLibrary,
    total: libraryTotal,
    reload: reloadLibrary,
  } = useBrowseFeed(feedSort, {})

  useEffect(() => {
    if (indexStatus.browse_ready > 0) {
      reloadLibrary()
      getStats().then((s) => setStatsTotal(s.browse_ready)).catch(() => {})
    }
  }, [indexStatus.browse_ready, reloadLibrary])

  useEffect(() => {
    if (!indexStatus.running) return
    refreshSources()
    const id = window.setInterval(refreshSources, 3000)
    return () => window.clearInterval(id)
  }, [indexStatus.running, indexStatus.phase, indexStatus.current, refreshSources])

  const prevIndexing = useRef(indexStatus.running)
  useEffect(() => {
    if (prevIndexing.current && !indexStatus.running) {
      refreshSources()
      reloadLibrary()
      getStats().then((s) => setStatsTotal(s.browse_ready)).catch(() => {})
    }
    prevIndexing.current = indexStatus.running
  }, [indexStatus.running, refreshSources, reloadLibrary])

  const {
    items: collectionItems,
    loading: collectionLoading,
    error: collectionError,
    hasMore: collectionHasMore,
    loadMore: loadMoreCollection,
    total: collectionTotal,
    reload: reloadCollection,
  } = useBrowseFeed(feedSort, collectionBrowseOptions, view === 'collections' && inCollectionDetail)

  const activeGridItems = view === 'collections' && inCollectionDetail ? collectionItems : libraryItems

  const refreshAlbums = useCallback(() => {
    getAlbums()
      .then((r) => setAlbums(r.albums))
      .catch(() => toast('Could not load albums', 'error'))
  }, [toast])

  const handleReorderAlbums = useCallback(async (albumIds: string[]) => {
    try {
      await reorderAlbums(albumIds)
      refreshAlbums()
    } catch {
      toast('Could not save album order', 'error')
      refreshAlbums()
    }
  }, [refreshAlbums, toast])

  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBulkAlbumOpen(false)
  }, [])

  useEffect(() => {
    getStats()
      .then((s) => setStatsTotal(s.browse_ready))
      .catch(() => toast('Could not reach the API. Start it with npm run dev:api', 'error'))
    getCollections()
      .then((r) => setCollections(r.collections))
      .catch(() => {})
    refreshAlbums()
  }, [refreshAlbums, toast])

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

  const runSearch = useCallback(
    async (term: string, activeChips: SearchChipState) => {
      const q = apiSearchQuery(term, activeChips)
      if (!q) {
        setSearchResults([])
        setSearchPlan(null)
        setSearching(false)
        return
      }

      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller

      setSearching(true)
      try {
        const data = await search(
          q,
          48,
          {
            match: activeChips.match,
            hasText: activeChips.content,
            folder: activeChips.folder,
          },
          controller.signal,
        )
        if (controller.signal.aborted) return
        setSearchResults(data.results)
        setSearchPlan(data.plan)
        if (data.results.length > 0) {
          recordSearchHistory(term.trim() || q.trim(), data.plan)
        }
      } catch {
        if (controller.signal.aborted) return
        setSearchResults([])
        setSearchPlan(null)
        toast('Search failed. Check that the API is running.', 'error')
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    },
    [recordSearchHistory, toast],
  )

  useEffect(() => {
    if (view !== 'search') return
    runSearch(debouncedQuery, chips)
  }, [debouncedQuery, chips, view, runSearch])

  useEffect(() => {
    return () => searchAbortRef.current?.abort()
  }, [])

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

  const handleOpenLibrary = (library: SourceSummary) => {
    setCollectionScope({ kind: 'source', id: library.id, name: library.name })
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
      toast(`Album "${name}" created`, 'success')
    } catch {
      toast('Could not create album', 'error')
    }
  }

  const collectionDetailCount =
    collectionScope.kind === 'album'
      ? albums.find((a) => a.id === collectionScope.id)?.count ?? collectionTotal
      : collectionScope.kind === 'folder'
        ? collections.find((c) => c.id === collectionScope.id)?.count ?? collectionTotal
        : collectionScope.kind === 'source'
          ? activeSources.find((s) => s.id === collectionScope.id)?.browse_count ??
            collectionTotal
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
    !collectionLoading &&
    !collectionError &&
    collectionItems.length === 0

  const emptyCollectionMessage =
    collectionScope.kind === 'folder'
      ? 'This subfolder has no indexed photos yet.'
      : collectionScope.kind === 'source'
        ? 'This library has no indexed photos yet.'
        : 'This album is empty. Select photos from your library and add them here.'

  const searchPending = view === 'search' && query.trim() !== debouncedQuery.trim()
  const searchActive =
    view === 'search' && (debouncedQuery.trim() !== '' || chipsAreActive(chips))
  const searchStatus = searching
    ? 'Searching'
    : searchPending
      ? 'Updating results'
      : searchActive && searchResults.length > 0
        ? `${searchResults.length} results`
        : searchActive && searchResults.length === 0 && !searching && !searchPending
          ? 'No results'
          : ''

  const showLibraryEmpty =
    view === 'library' &&
    !libraryLoading &&
    !libraryError &&
    libraryItems.length === 0

  const libraryIndexed = statsTotal > 0 || libraryTotal > 0

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

  const handleAddFolder = async () => {
    try {
      const source = await pickAndAdd()
      if (source) {
        toast(`Added ${source.name}`, 'success')
        reloadLibrary()
        refreshSources()
        return true
      }
      return false
    } catch {
      toast('Could not add folder', 'error')
      return false
    }
  }

  const handleSkipOnboarding = () => {
    localStorage.setItem(ONBOARDING_SKIP_KEY, '1')
    setOnboardingSkipped(true)
  }

  if (showOnboarding) {
    return (
      <OnboardingView
        indexStatus={indexStatus}
        onAddFolder={handleAddFolder}
        onSkip={handleSkipOnboarding}
        onDone={() => {
          setOnboardingDone(true)
          reloadLibrary()
          refreshSources()
        }}
      />
    )
  }

  return (
    <div className="app-shell min-h-dvh bg-bg-base text-text-primary">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {searchStatus}
      </p>

      <div className="app-shell-grid relative z-10 h-full md:pb-0">
        <Titlebar />
        <EdgeRail
          view={view}
          onViewChange={handleViewChange}
          themeMode={themeMode}
          onThemeCycle={cycleTheme}
          onOpenSources={openSources}
        />

        <div className="app-canvas flex min-h-0 flex-1 flex-col">
        <MobileHeader
          view={view}
          total={mobileHeaderTotal}
          themeMode={themeMode}
          onThemeCycle={cycleTheme}
          drillIn={mobileDrillIn}
          selectionMode={selectionMode}
          onEnterSelection={
            view === 'library' || (view === 'collections' && inCollectionDetail)
              ? enterSelectionMode
              : undefined
          }
          sort={feedSort}
          onSortChange={setFeedSort}
          showSort={view === 'library'}
          sourcesLabel={sourcesLabel}
          onOpenSources={openSources}
        />

        {desktop && (
          <IndexProgressBanner
            status={indexStatus}
            sources={sources}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        {view === 'library' && (
          <div key="library" className="view-enter flex flex-1 flex-col">
            {selectHint.visible && !selectionMode && libraryItems.length > 0 && (
              <ContextHint onDismiss={selectHint.dismiss} label="Selection tip">
                Use <strong>Select</strong> to choose photos. Drag across the grid to select many at once.
              </ContextHint>
            )}
            {selectionMode && (
              <button
                type="button"
                className="selection-backdrop"
                aria-label="Cancel selection"
                onClick={exitSelection}
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
            <LibraryToolbar
              total={statsTotal || libraryTotal}
              sort={feedSort}
              onSortChange={setFeedSort}
              selectionMode={selectionMode}
              onEnterSelection={enterSelectionMode}
              sourcesLabel={sourcesLabel}
              onOpenSources={openSources}
            />
            <main
              id="main-content"
              className="canvas-main canvas-main-pad"
              onClick={handleGridMainClick}
            >
              {showLibraryEmpty ? (
                <LibraryEmpty
                  indexed={libraryIndexed}
                  desktop={desktop}
                  onAddFolder={() => {
                    void handleAddFolder()
                  }}
                  onTryDiscover={() => setView('discover')}
                />
              ) : (
              <PhotoGrid
                items={libraryItems}
                onSelect={(item) => {
                  if (!selectionMode) setSelectedId(item.id)
                }}
                onLoadMore={loadMoreLibrary}
                hasMore={libraryHasMore}
                loading={libraryLoading}
                error={libraryError}
                onRetry={reloadLibrary}
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

        {view === 'collections' && (
          <div key="collections" className="view-enter flex flex-1 flex-col">
            {selectionMode && inCollectionDetail && (
              <button
                type="button"
                className="selection-backdrop"
                aria-label="Cancel selection"
                onClick={exitSelection}
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
              className={`canvas-main canvas-main-pad ${
                inCollectionDetail ? '' : 'pt-4 md:pt-5'
              }`}
              onClick={inCollectionDetail ? handleGridMainClick : undefined}
            >
              {!inCollectionDetail ? (
                <CollectionsView
                  albums={albums}
                  libraries={activeSources}
                  folders={collections}
                  onOpenAlbum={handleOpenAlbum}
                  onOpenLibrary={handleOpenLibrary}
                  onOpenFolder={handleOpenFolder}
                  onNewAlbum={() => setNewAlbumOpen(true)}
                  onManageAlbum={setManagingAlbum}
                  onReorderAlbums={handleReorderAlbums}
                />
              ) : emptyCollection ? (
                <div className="search-empty">
                  <h2 className="type-heading text-text-primary">{emptyCollectionMessage}</h2>
                </div>
              ) : (
                <PhotoGrid
                  items={collectionItems}
                  onSelect={(item) => {
                    if (!selectionMode) setSelectedId(item.id)
                  }}
                  onLoadMore={loadMoreCollection}
                  hasMore={collectionHasMore}
                  loading={collectionLoading}
                  error={collectionError}
                  onRetry={reloadCollection}
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
            {searchHint.visible && (
              <ContextHint onDismiss={searchHint.dismiss} label="Search tip">
                Results update as you type. Press <strong>/</strong> from anywhere to jump here.
              </ContextHint>
            )}
            <SearchView
              query={query}
              onQueryChange={setQuery}
              chips={chips}
              onChipsChange={setChips}
              collections={collections}
              searching={searching}
              pending={searchPending}
              plan={searchPlan}
              resultCount={
                searchActive && !searching && !searchPending
                  ? searchResults.length
                  : undefined
              }
              history={searchHistory}
              onPickHistory={(entry) => {
                setQuery(entry.plan.vibe_text || entry.query)
                setChips(chipsFromPlan(entry.plan))
              }}
              onClearHistory={clearSearchHistory}
              searchPartial={searchPartial}
            />
            <main id="main-content" className="canvas-main canvas-main-pad pt-1">
              {!searching && !searchPending && searchResults.length === 0 && searchActive && (
                <div className="search-empty">
                  <h2 className="type-heading text-text-primary">No matches</h2>
                  <p className="type-caption">
                    Try Broad match, drop a filter, or use different words.
                  </p>
                </div>
              )}
              {!searching && !searchPending && searchResults.length === 0 && !searchActive && (
                <div className="search-landing">
                  <div className="search-empty">
                    <h2 className="type-heading text-text-primary">Find anything you saved</h2>
                    <p className="type-caption">
                      Mood, an exact quote, a folder, or a year. Press / from anywhere.
                    </p>
                  </div>
                  {libraryItems.length > 0 && (
                    <section className="search-recent" aria-label="Recent photos">
                      <div className="search-recent-head">
                        <h3 className="type-meta">Recent</h3>
                        <button
                          type="button"
                          className="search-meta-link"
                          onClick={() => setView('library')}
                        >
                          Open library
                        </button>
                      </div>
                      <div className="search-recent-grid">
                        {libraryItems.slice(0, 16).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="search-recent-tile"
                            onClick={() => setSelectedId(item.id)}
                          >
                            <img src={thumbUrl(item.id)} alt="" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
              {searchResults.length > 0 && (
                <PhotoGrid
                  items={searchResults}
                  onSelect={(item) => setSelectedId(item.id)}
                  showMatchKind
                />
              )}
            </main>
          </div>
        )}

        <BottomNav view={view} onViewChange={handleViewChange} hidden={hideBottomNav} />
        </div>
      </div>

      {settingsOpen && (
        <SourcesSettings
          sources={sources}
          indexStatus={indexStatus}
          onAddFolder={async () => {
            await handleAddFolder()
          }}
          onRemove={removeSource}
          onRescan={rescan}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {newAlbumOpen && (
        <NewAlbumSheet
          name={newAlbumName}
          onNameChange={setNewAlbumName}
          onSubmit={handleCreateAlbum}
          onClose={() => setNewAlbumOpen(false)}
        />
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
