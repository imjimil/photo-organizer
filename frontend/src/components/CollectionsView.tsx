import { useCallback, useMemo, useRef, type CSSProperties, type PointerEvent } from 'react'
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

  let stagger = 0

  return (
    <div className="collections-view">
      <header className="collections-hero hidden md:block">
        <p className="collections-hero-eyebrow type-eyebrow">Organize</p>
        <h1 className="collections-hero-title text-text-primary">Collections</h1>
        <p className="collections-hero-lead type-caption">
          Libraries from your disk, albums you curate, and folder groups
        </p>
      </header>

      {libraries.length > 0 && (
        <section className="col-section" aria-labelledby="libraries-heading">
          <SectionHeader
            id="libraries-heading"
            title="Libraries"
            desc="Folders added to Opal"
          />
          <div className="col-grid col-grid-wide">
            {libraries.map((library) => {
              const i = stagger++
              return (
                <CollectionTile
                  key={library.id}
                  stagger={i}
                  title={library.name}
                  subtitle={library.path}
                  count={library.browse_count}
                  coverUrl={
                    library.cover_photo_id ? thumbUrl(library.cover_photo_id) : null
                  }
                  variant="library"
                  onOpen={() => onOpenLibrary(library)}
                />
              )
            })}
          </div>
        </section>
      )}

      <section className="col-section" aria-labelledby="albums-heading">
        <SectionHeader
          id="albums-heading"
          title="Albums"
          desc="Curated sets you build"
        />

        <div className="col-grid" ref={gridRef}>
          <div data-flip-id="new-album" className="col-slot">
            <CollectionTile
              stagger={stagger++}
              title="New album"
              count={0}
              variant="new"
              onOpen={onNewAlbum}
            />
          </div>

          {favoritesAlbum && (
            <div data-flip-id={favoritesAlbum.id} className="col-slot">
              <CollectionTile
                stagger={stagger++}
                title={favoritesAlbum.name}
                count={favoritesAlbum.count}
                coverUrl={
                  favoritesAlbum.cover_photo_id
                    ? thumbUrl(favoritesAlbum.cover_photo_id)
                    : null
                }
                variant="favorites"
                onOpen={() => onOpenAlbum(favoritesAlbum)}
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
                className={`col-slot ${isDragging ? 'col-slot-source' : ''}`}
                style={isDragging && dragVisual ? { minHeight: dragVisual.height } : undefined}
                aria-hidden={isDragging}
              >
                {!isDragging && (
                  <DraggableAlbumTile
                    album={album}
                    stagger={stagger++}
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
          <p className="col-empty-hint type-caption">Your first album is one tap away</p>
        )}

        {userAlbums.length > 1 && (
          <p id="collections-reorder-hint" className="col-reorder-hint type-caption">
            Drag albums to reorder
          </p>
        )}
      </section>

      {folders.length > 0 && (
        <section className="col-section" aria-labelledby="folders-heading">
          <SectionHeader
            id="folders-heading"
            title="Subfolders"
            desc="Groups inside your photos on disk"
          />
          <div className="col-grid">
            {folders.map((folder) => (
              <CollectionTile
                key={folder.id}
                stagger={stagger++}
                title={folder.name}
                count={folder.count}
                coverUrl={
                  folder.cover_photo_id ? thumbUrl(folder.cover_photo_id) : null
                }
                variant="folder"
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
            <CollectionTile
              title={draggingAlbum.name}
              count={draggingAlbum.count}
              coverUrl={
                draggingAlbum.cover_photo_id
                  ? thumbUrl(draggingAlbum.cover_photo_id)
                  : null
              }
              variant="album"
              dragging
              onOpen={() => {}}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}

function SectionHeader({
  id,
  title,
  desc,
}: {
  id: string
  title: string
  desc: string
}) {
  return (
    <div className="col-section-head">
      <h2 id={id} className="col-section-title text-text-primary">
        {title}
      </h2>
      <p className="col-section-desc type-caption text-text-muted">{desc}</p>
    </div>
  )
}

type TileVariant = 'library' | 'album' | 'folder' | 'favorites' | 'new'

function CollectionTile({
  title,
  subtitle,
  count,
  coverUrl,
  variant = 'album',
  stagger = 0,
  dragging = false,
  onOpen,
}: {
  title: string
  subtitle?: string
  count: number
  coverUrl?: string | null
  variant?: TileVariant
  stagger?: number
  dragging?: boolean
  onOpen: () => void
}) {
  const showCount = variant !== 'new' && count > 0

  return (
    <button
      type="button"
      className={`col-tile col-tile-${variant} ${dragging ? 'col-tile-dragging' : ''}`}
      style={{ '--stagger': stagger } as CSSProperties}
      onClick={onOpen}
    >
      <div className="col-tile-cover">
        {variant === 'new' ? (
          <div className="col-tile-new-inner">
            <span className="col-tile-new-icon" aria-hidden>
              +
            </span>
          </div>
        ) : coverUrl ? (
          <img src={coverUrl} alt="" loading="lazy" draggable={false} />
        ) : (
          <TileFallback variant={variant} title={title} />
        )}
        <div className="col-tile-shade" aria-hidden />
        {showCount && (
          <span className="col-tile-badge type-meta">{count.toLocaleString()}</span>
        )}
      </div>
      <div className="col-tile-meta">
        <span className="col-tile-title">{title}</span>
        {subtitle && variant === 'library' && (
          <span className="col-tile-sub type-caption text-text-faint">{subtitle}</span>
        )}
      </div>
    </button>
  )
}

function TileFallback({ variant, title }: { variant: TileVariant; title: string }) {
  if (variant === 'favorites') {
    return (
      <div className="col-tile-fallback col-tile-fallback-favorites">
        <IconStar className="col-tile-star" filled />
      </div>
    )
  }
  if (variant === 'folder') {
    return (
      <div className="col-tile-fallback col-tile-fallback-folder">
        <FolderGlyph />
      </div>
    )
  }
  if (variant === 'library') {
    return (
      <div className="col-tile-fallback col-tile-fallback-library">
        <FolderGlyph />
      </div>
    )
  }
  return (
    <div className="col-tile-fallback">
      <span aria-hidden>{title.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function FolderGlyph() {
  return (
    <svg className="col-tile-folder-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5c0-1.1.9-2 2-2h4.5L12 8h6c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DraggableAlbumTile({
  album,
  stagger,
  onOpen,
  onManage,
  onHandlePointerDown,
}: {
  album: AlbumSummary
  stagger: number
  onOpen: () => void
  onManage: () => void
  onHandlePointerDown: (event: PointerEvent<HTMLElement>) => void
}) {
  return (
    <div className="col-tile-wrap">
      <CollectionTile
        stagger={stagger}
        title={album.name}
        count={album.count}
        coverUrl={album.cover_photo_id ? thumbUrl(album.cover_photo_id) : null}
        variant="album"
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
