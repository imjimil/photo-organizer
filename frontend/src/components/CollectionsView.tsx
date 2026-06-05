import { useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { AlbumSummary, CollectionSummary, SourceSummary } from '../api/client'
import { isFavoritesAlbum, thumbUrl } from '../api/client'
import { useAlbumReorder } from '../hooks/useAlbumReorder'
import { useFlipList } from '../hooks/useFlipList'
import { IconGrip, IconStar } from './ViewerIcons'

interface CollectionsViewProps {
  albums: AlbumSummary[]
  libraries: SourceSummary[]
  folders: CollectionSummary[]
  onOpenAlbum: (album: AlbumSummary) => void
  onOpenLibrary: (library: SourceSummary) => void
  onOpenFolder: (folder: CollectionSummary) => void
  onNewAlbum: () => void
  onManageAlbum: (album: AlbumSummary) => void
  onReorderAlbums: (albumIds: string[]) => Promise<void>
}

export function CollectionsView({
  albums,
  libraries,
  folders,
  onOpenAlbum,
  onOpenLibrary,
  onOpenFolder,
  onNewAlbum,
  onManageAlbum,
  onReorderAlbums,
}: CollectionsViewProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const favoritesAlbum = albums.find(isFavoritesAlbum)
  const userAlbums = useMemo(
    () => albums.filter((album) => !isFavoritesAlbum(album)),
    [albums],
  )

  const commitOrder = useCallback(
    (orderedIds: string[]) => onReorderAlbums(orderedIds),
    [onReorderAlbums],
  )

  const {
    orderedItems: orderedUserAlbums,
    draggingId,
    dragVisual,
    overlayRef,
    handlePointerDown,
    shouldSuppressClick,
  } = useAlbumReorder(userAlbums, gridRef, commitOrder)

  const draggingAlbum = draggingId
    ? orderedUserAlbums.find((album) => album.id === draggingId)
    : undefined

  const flipKey = `new|${favoritesAlbum?.id ?? ''}|${orderedUserAlbums.map((album) => album.id).join(',')}`
  useFlipList(gridRef, flipKey, !draggingId)

  return (
    <div className="collections-view">
      <header className="collections-page-intro hidden md:block">
        <h1 className="page-intro-title text-text-primary">Collections</h1>
        <p className="type-caption text-text-muted mt-1">
          Albums, libraries, and folders as stacked prints
        </p>
      </header>

      {libraries.length > 0 && (
        <section className="collections-section" aria-labelledby="libraries-heading">
          <div className="collections-section-head">
            <h2 id="libraries-heading" className="type-heading text-text-primary">
              Libraries
            </h2>
            <p className="type-caption text-text-muted">Folders you added to Opal</p>
          </div>
          <div className="print-stacks">
            {libraries.map((library, index) => (
              <PrintStack
                key={library.id}
                title={library.name}
                count={library.browse_count}
                size={index % 3}
                onOpen={() => onOpenLibrary(library)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="collections-section" aria-labelledby="albums-heading">
        <div className="collections-section-head">
          <h2 id="albums-heading" className="type-heading text-text-primary">
            Albums
          </h2>
          <p className="type-caption text-text-muted">Curated sets you build</p>
        </div>

        <div className="print-stacks" ref={gridRef}>
          <div data-flip-id="new-album" className="print-stack-slot">
            <button type="button" className="print-stack print-stack-new" onClick={onNewAlbum}>
              <div className="print-stack-sheets">
                <div className="print-stack-sheet print-stack-sheet-empty" />
                <div className="print-stack-sheet print-stack-sheet-empty" />
                <div className="print-stack-sheet print-stack-sheet-empty print-stack-sheet-front">
                  <span className="print-stack-new-icon" aria-hidden>+</span>
                </div>
              </div>
              <span className="print-stack-tape">New album</span>
            </button>
          </div>

          {favoritesAlbum && (
            <div data-flip-id={favoritesAlbum.id} className="print-stack-slot">
              <PrintStack
                title={favoritesAlbum.name}
                count={favoritesAlbum.count}
                coverUrl={
                  favoritesAlbum.cover_photo_id ? thumbUrl(favoritesAlbum.cover_photo_id) : null
                }
                size={1}
                onOpen={() => onOpenAlbum(favoritesAlbum)}
                kind="favorites"
              />
            </div>
          )}

          {orderedUserAlbums.map((album, index) => {
            const isDragging = draggingId === album.id

            return (
              <div
                key={album.id}
                data-flip-id={album.id}
                data-album-slot={album.id}
                className={`print-stack-slot ${isDragging ? 'print-stack-slot-source' : ''}`}
                style={isDragging && dragVisual ? { minHeight: dragVisual.height } : undefined}
                aria-hidden={isDragging}
              >
                {!isDragging && (
                  <DraggablePrintStack
                    album={album}
                    size={(index + 2) % 3}
                    onOpen={() => {
                      if (shouldSuppressClick()) return
                      onOpenAlbum(album)
                    }}
                    onManage={() => onManageAlbum(album)}
                    onHandlePointerDown={(event) => handlePointerDown(album.id, event)}
                  />
                )}
              </div>
            )
          })}
        </div>

        {userAlbums.length === 0 && (
          <p className="type-caption collections-empty-hint">
            Your first album is one tap away
          </p>
        )}

        {userAlbums.length > 1 && (
          <p id="collections-reorder-hint" className="type-caption collections-reorder-hint">
            Drag albums to reorder
          </p>
        )}
      </section>

      {folders.length > 0 && (
        <section className="collections-section" aria-labelledby="folders-heading">
          <div className="collections-section-head">
            <h2 id="folders-heading" className="type-heading text-text-primary">
              Subfolders
            </h2>
            <p className="type-caption text-text-muted">Groups inside your photos on disk</p>
          </div>
          <div className="print-stacks">
            {folders.map((folder, index) => (
              <PrintStack
                key={folder.id}
                title={folder.name}
                count={folder.count}
                size={(index + 1) % 3}
                onOpen={() => onOpenFolder(folder)}
              />
            ))}
          </div>
        </section>
      )}

      {draggingAlbum &&
        dragVisual &&
        createPortal(
          <div
            ref={overlayRef}
            className="collection-drag-overlay"
            style={{ width: dragVisual.width }}
            aria-hidden
          >
            <PrintStack
              title={draggingAlbum.name}
              count={draggingAlbum.count}
              coverUrl={
                draggingAlbum.cover_photo_id ? thumbUrl(draggingAlbum.cover_photo_id) : null
              }
              size={1}
              onOpen={() => {}}
              dragging
            />
          </div>,
          document.body,
        )}
    </div>
  )
}

function PrintStack({
  title,
  count,
  coverUrl,
  onOpen,
  size = 0,
  kind = 'album',
  dragging = false,
}: {
  title: string
  count: number
  coverUrl?: string | null
  onOpen: () => void
  size?: number
  kind?: 'album' | 'favorites'
  dragging?: boolean
}) {
  return (
    <button
      type="button"
      className={`print-stack print-stack-size-${size} ${dragging ? 'print-stack-dragging' : ''}`}
      onClick={onOpen}
    >
      <div className="print-stack-sheets">
        <div className="print-stack-sheet print-stack-sheet-back">
          {coverUrl ? <img src={coverUrl} alt="" draggable={false} /> : <SheetPlaceholder kind={kind} title={title} />}
        </div>
        <div className="print-stack-sheet print-stack-sheet-mid">
          {coverUrl ? <img src={coverUrl} alt="" draggable={false} /> : <SheetPlaceholder kind={kind} title={title} />}
        </div>
        <div className="print-stack-sheet print-stack-sheet-front">
          {coverUrl ? (
            <img src={coverUrl} alt="" loading="lazy" draggable={false} />
          ) : (
            <SheetPlaceholder kind={kind} title={title} />
          )}
        </div>
      </div>
      <span className="print-stack-tape">
        <span className="print-stack-tape-name">{title}</span>
        <span className="print-stack-tape-count type-meta">{count.toLocaleString()}</span>
      </span>
    </button>
  )
}

function SheetPlaceholder({
  kind,
  title,
}: {
  kind: 'album' | 'favorites'
  title: string
}) {
  if (kind === 'favorites') {
    return (
      <div className="print-stack-placeholder print-stack-placeholder-favorites">
        <IconStar className="print-stack-star" filled />
      </div>
    )
  }
  return (
    <div className="print-stack-placeholder">
      <span aria-hidden>{title.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function DraggablePrintStack({
  album,
  size,
  onOpen,
  onManage,
  onHandlePointerDown,
}: {
  album: AlbumSummary
  size: number
  onOpen: () => void
  onManage: () => void
  onHandlePointerDown: (event: React.PointerEvent<HTMLElement>) => void
}) {
  return (
    <div className="print-stack-wrap">
      <PrintStack
        title={album.name}
        count={album.count}
        coverUrl={album.cover_photo_id ? thumbUrl(album.cover_photo_id) : null}
        size={size}
        onOpen={onOpen}
      />

      <button
        type="button"
        className="collection-card-drag-handle"
        aria-label={`Reorder ${album.name}`}
        aria-describedby="collections-reorder-hint"
        onPointerDown={onHandlePointerDown}
        onClick={(event) => event.stopPropagation()}
      >
        <IconGrip />
      </button>

      <button
        type="button"
        className="collection-card-menu"
        aria-label={`Manage ${album.name}`}
        onClick={(event) => {
          event.stopPropagation()
          onManage()
        }}
      >
        ···
      </button>
    </div>
  )
}
