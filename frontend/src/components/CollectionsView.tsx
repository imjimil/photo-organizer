import { useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { AlbumSummary, CollectionSummary } from '../api/client'
import { isFavoritesAlbum, thumbUrl } from '../api/client'
import { useAlbumReorder } from '../hooks/useAlbumReorder'
import { useFlipList } from '../hooks/useFlipList'
import { IconGrip, IconStar } from './ViewerIcons'

interface CollectionsViewProps {
  albums: AlbumSummary[]
  folders: CollectionSummary[]
  onOpenAlbum: (album: AlbumSummary) => void
  onOpenFolder: (folder: CollectionSummary) => void
  onNewAlbum: () => void
  onManageAlbum: (album: AlbumSummary) => void
  onReorderAlbums: (albumIds: string[]) => Promise<void>
}

export function CollectionsView({
  albums,
  folders,
  onOpenAlbum,
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
      <section className="collections-section" aria-labelledby="albums-heading">
        <div className="collections-section-head">
          <h2 id="albums-heading" className="type-heading text-text-primary">
            Albums
          </h2>
          <p className="type-caption text-text-muted">Curated sets you build</p>
        </div>

        <div className="collections-grid" ref={gridRef}>
          <div data-flip-id="new-album" className="collection-grid-item">
            <button type="button" className="collection-card" onClick={onNewAlbum}>
              <div className="collection-card-cover collection-card-cover-new">
                <span className="collection-card-new-icon" aria-hidden>
                  +
                </span>
              </div>
              <span className="collection-card-label">New album</span>
            </button>
          </div>

          {favoritesAlbum && (
            <div data-flip-id={favoritesAlbum.id} className="collection-grid-item">
              <CollectionCard
                title={favoritesAlbum.name}
                count={favoritesAlbum.count}
                coverUrl={
                  favoritesAlbum.cover_photo_id ? thumbUrl(favoritesAlbum.cover_photo_id) : null
                }
                onOpen={() => onOpenAlbum(favoritesAlbum)}
                kind="favorites"
              />
            </div>
          )}

          {orderedUserAlbums.map((album) => {
            const isDragging = draggingId === album.id

            return (
              <div
                key={album.id}
                data-flip-id={album.id}
                data-album-slot={album.id}
                className={`collection-grid-item ${isDragging ? 'collection-grid-item-source' : ''}`}
                style={isDragging && dragVisual ? { minHeight: dragVisual.height } : undefined}
                aria-hidden={isDragging}
              >
                {!isDragging && (
                  <DraggableAlbumCard
                    album={album}
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
              Folders
            </h2>
            <p className="type-caption text-text-muted">From your library on disk</p>
          </div>
          <div className="collections-grid">
            {folders.map((folder) => (
              <CollectionCard
                key={folder.id}
                title={folder.name}
                count={folder.count}
                onOpen={() => onOpenFolder(folder)}
                kind="folder"
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
            <AlbumDragPreview album={draggingAlbum} />
          </div>,
          document.body,
        )}
    </div>
  )
}

function AlbumDragPreview({ album }: { album: AlbumSummary }) {
  return (
    <div className="collection-card-wrap collection-card-wrap-dragging">
      <div className="collection-card">
        <div className="collection-card-cover">
          {album.cover_photo_id ? (
            <img
              src={thumbUrl(album.cover_photo_id)}
              alt=""
              className="collection-card-img"
              draggable={false}
            />
          ) : (
            <div className="collection-card-placeholder collection-card-placeholder-album">
              <span className="collection-card-initial" aria-hidden>
                {album.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <span className="collection-card-label">{album.name}</span>
        <span className="collection-card-count type-meta">{album.count.toLocaleString()}</span>
      </div>
    </div>
  )
}

function DraggableAlbumCard({
  album,
  onOpen,
  onManage,
  onHandlePointerDown,
}: {
  album: AlbumSummary
  onOpen: () => void
  onManage: () => void
  onHandlePointerDown: (event: React.PointerEvent<HTMLElement>) => void
}) {
  return (
    <div className="collection-card-wrap">
      <button type="button" className="collection-card" onClick={onOpen}>
        <div className="collection-card-cover">
          {album.cover_photo_id ? (
            <img
              src={thumbUrl(album.cover_photo_id)}
              alt=""
              className="collection-card-img"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="collection-card-placeholder collection-card-placeholder-album">
              <span className="collection-card-initial" aria-hidden>
                {album.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <span className="collection-card-label">{album.name}</span>
        <span className="collection-card-count type-meta">{album.count.toLocaleString()}</span>
      </button>

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

function CollectionCard({
  title,
  count,
  coverUrl,
  onOpen,
  onManage,
  kind,
}: {
  title: string
  count: number
  coverUrl?: string | null
  onOpen: () => void
  onManage?: () => void
  kind: 'album' | 'folder' | 'favorites'
}) {
  return (
    <div className="collection-card-wrap">
      <button type="button" className="collection-card" onClick={onOpen}>
        <div className="collection-card-cover">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="collection-card-img" loading="lazy" />
          ) : (
            <div className={`collection-card-placeholder collection-card-placeholder-${kind}`}>
              {kind === 'favorites' ? (
                <IconStar className="collection-card-star" filled />
              ) : (
                <span className="collection-card-initial" aria-hidden>
                  {title.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="collection-card-label">{title}</span>
        <span className="collection-card-count type-meta">{count.toLocaleString()}</span>
      </button>
      {onManage && (
        <button
          type="button"
          className="collection-card-menu"
          aria-label={`Manage ${title}`}
          onClick={(e) => {
            e.stopPropagation()
            onManage()
          }}
        >
          ···
        </button>
      )}
    </div>
  )
}
