import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  exportUrl,
  getFavoriteStatus,
  getImage,
  getSimilar,
  mediaUrl,
  thumbUrl,
  toggleFavorite,
  type ImageDetail,
  type SearchResult,
} from '../api/client'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { usePinchZoom } from '../hooks/usePinchZoom'
import { imageAltText } from '../utils/imageLabel'
import { AlbumPicker } from './AlbumPicker'
import {
  IconAlbum,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconCopy,
  IconDownload,
  IconFolder,
  IconRelated,
  IconShare,
  IconStar,
} from './ViewerIcons'

interface LightboxProps {
  imageId: string
  imageIds: string[]
  onClose: () => void
  onSelect: (id: string) => void
  onAlbumsChanged?: () => void
}

function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function Lightbox({
  imageId,
  imageIds,
  onClose,
  onSelect,
  onAlbumsChanged,
}: LightboxProps) {
  const [detail, setDetail] = useState<ImageDetail | null>(null)
  const [similar, setSimilar] = useState<SearchResult[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [relatedOpen, setRelatedOpen] = useState(false)
  const [albumPickerOpen, setAlbumPickerOpen] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const dialogRef = useFocusTrap(true, '[data-viewer-close]')
  const { containerRef, reset, handlers } = usePinchZoom({ maxScale: 5 })

  const index = imageIds.indexOf(imageId)
  const hasPrev = index > 0
  const hasNext = index >= 0 && index < imageIds.length - 1
  const hasQuote = Boolean(detail?.ocr_text?.trim())
  const isDesktop = isDesktopShell()

  const goPrev = useCallback(() => {
    if (!hasPrev) return
    onSelect(imageIds[index - 1])
  }, [hasPrev, imageIds, index, onSelect])

  const goNext = useCallback(() => {
    if (!hasNext) return
    onSelect(imageIds[index + 1])
  }, [hasNext, imageIds, index, onSelect])

  useEffect(() => {
    setDetail(null)
    setSimilar([])
    setRelatedOpen(false)
    reset()
    getImage(imageId).then(setDetail).catch(() => {})
    getSimilar(imageId, 12)
      .then((r) => setSimilar(r.results))
      .catch(() => {})
    getFavoriteStatus(imageId)
      .then((r) => setFavorited(r.favorited))
      .catch(() => setFavorited(false))
  }, [imageId, reset])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  const copyQuote = async () => {
    if (!detail?.ocr_text) return
    try {
      await navigator.clipboard.writeText(detail.ocr_text)
      showToast('Text copied')
    } catch {
      showToast('Could not copy')
    }
  }

  const shareImage = async () => {
    const url = mediaUrl(imageId)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Opal', url })
        return
      }
      await navigator.clipboard.writeText(url)
      showToast('Link copied')
    } catch {
      /* user dismissed */
    }
  }

  const handleToggleFavorite = async () => {
    if (favoriteBusy) return
    setFavoriteBusy(true)
    try {
      const result = await toggleFavorite(imageId)
      setFavorited(result.favorited)
      onAlbumsChanged?.()
      showToast(result.favorited ? 'Added to Favorites' : 'Removed from Favorites')
    } catch {
      showToast('Could not update Favorites')
    } finally {
      setFavoriteBusy(false)
    }
  }

  const saveImage = async () => {
    const url = exportUrl(imageId)
    const filename = detail?.rel_path.split(/[/\\]/).pop() ?? `opal-${imageId}.jpg`

    if (isDesktop && detail?.absolute_path) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const { invoke } = await import('@tauri-apps/api/core')
        const dest = await save({ defaultPath: filename })
        if (!dest) return
        await invoke('copy_file', { from: detail.absolute_path, to: dest })
        showToast('Image saved')
        return
      } catch {
        showToast('Could not save')
        return
      }
    }

    try {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      showToast('Download started')
    } catch {
      showToast('Could not save')
    }
  }

  const revealInExplorer = async () => {
    if (!detail?.absolute_path) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('reveal_in_file_manager', { path: detail.absolute_path })
    } catch {
      showToast('Could not reveal file')
    }
  }

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (albumPickerOpen) setAlbumPickerOpen(false)
        else if (relatedOpen) setRelatedOpen(false)
        else onClose()
      }
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    },
    [albumPickerOpen, goNext, goPrev, onClose, relatedOpen],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  const handleBackdropClose = () => {
    if (albumPickerOpen) {
      setAlbumPickerOpen(false)
      return
    }
    if (relatedOpen) {
      setRelatedOpen(false)
      return
    }
    onClose()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return
    if (dx > 0) goPrev()
    else goNext()
  }

  const counter =
    index >= 0 && imageIds.length > 0
      ? `${index + 1} / ${imageIds.length.toLocaleString()}`
      : '—'

  return (
    <div
      ref={dialogRef}
      className="viewer-scrim fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <header className="viewer-bar">
        <button
          type="button"
          data-viewer-close
          onClick={onClose}
          className="viewer-bar-btn"
          aria-label="Close"
        >
          <IconClose className="h-[1.125rem] w-[1.125rem]" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <p className="viewer-counter">{counter}</p>
        <div className="viewer-bar-actions hidden md:flex">
          {hasQuote && (
            <button type="button" onClick={copyQuote} className="viewer-bar-btn" aria-label="Copy text">
              <IconCopy className="h-[1.125rem] w-[1.125rem]" />
              Copy
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={favoriteBusy}
            className={`viewer-bar-btn ${favorited ? 'viewer-bar-btn-active' : ''}`}
            aria-label={favorited ? 'Remove from Favorites' : 'Add to Favorites'}
            aria-pressed={favorited}
          >
            <IconStar className="h-[1.125rem] w-[1.125rem]" filled={favorited} />
            Favorite
          </button>
          <button
            type="button"
            onClick={() => setAlbumPickerOpen(true)}
            className={`viewer-bar-btn ${albumPickerOpen ? 'viewer-bar-btn-active' : ''}`}
            aria-label="Add to album"
          >
            <IconAlbum className="h-[1.125rem] w-[1.125rem]" />
            Album
          </button>
          <button type="button" onClick={saveImage} className="viewer-bar-btn" aria-label="Save image">
            <IconDownload className="h-[1.125rem] w-[1.125rem]" />
            Save
          </button>
          {isDesktop && (
            <button type="button" onClick={revealInExplorer} className="viewer-bar-btn" aria-label="Reveal in Explorer">
              <IconFolder className="h-[1.125rem] w-[1.125rem]" />
              Reveal
            </button>
          )}
          <button
            type="button"
            onClick={() => setRelatedOpen((v) => !v)}
            disabled={similar.length === 0}
            className={`viewer-bar-btn ${relatedOpen ? 'viewer-bar-btn-active' : ''}`}
            aria-label="Related images"
            aria-pressed={relatedOpen}
          >
            <IconRelated className="h-[1.125rem] w-[1.125rem]" />
            Related
          </button>
          <button type="button" onClick={shareImage} className="viewer-bar-btn" aria-label="Share">
            <IconShare className="h-[1.125rem] w-[1.125rem]" />
            Share
          </button>
        </div>
      </header>

      <div
        className="relative min-h-0 flex-1"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute inset-0 z-0 cursor-default"
          onClick={handleBackdropClose}
          onKeyDown={() => {}}
          role="presentation"
        />

        {hasPrev && (
          <button
            type="button"
            onClick={goPrev}
            className="viewer-nav-btn viewer-nav-btn-prev"
            aria-label="Previous image"
          >
            <IconChevronLeft />
          </button>
        )}

        {hasNext && (
          <button
            type="button"
            onClick={goNext}
            className="viewer-nav-btn viewer-nav-btn-next"
            aria-label="Next image"
          >
            <IconChevronRight />
          </button>
        )}

        <div className="pointer-events-none relative z-10 flex h-full items-center justify-center px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-2 md:px-20 md:pb-8 md:pt-2">
          <div
            ref={containerRef}
            className="pointer-events-auto touch-none"
            {...handlers}
          >
            {detail ? (
              <img
                data-zoom-target
                src={mediaUrl(detail.id)}
                alt={imageAltText(detail)}
                draggable={false}
                className="viewer-float max-h-[72dvh] max-w-full object-contain will-change-transform md:max-h-[82dvh]"
                style={{ transform: 'translate3d(0,0,0) scale(1)' }}
              />
            ) : (
              <p className="type-eyebrow pulse-soft pointer-events-none text-text-primary" aria-live="polite">
                Loading
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="viewer-toolbar-wrap">
        <div className="viewer-toolbar" role="toolbar" aria-label="Image actions">
          <ToolbarButton
            label="Previous"
            disabled={!hasPrev}
            onClick={goPrev}
            className="viewer-tool-btn-nav"
            icon={<IconChevronLeft className="h-[1.125rem] w-[1.125rem]" />}
          />
          {hasQuote && (
            <ToolbarButton
              label="Copy"
              onClick={copyQuote}
              icon={<IconCopy className="h-[1.125rem] w-[1.125rem]" />}
            />
          )}
          <ToolbarButton
            label="Favorite"
            active={favorited}
            disabled={favoriteBusy}
            onClick={handleToggleFavorite}
            icon={<IconStar className="h-[1.125rem] w-[1.125rem]" filled={favorited} />}
          />
          <ToolbarButton
            label="Album"
            active={albumPickerOpen}
            onClick={() => setAlbumPickerOpen(true)}
            icon={<IconAlbum className="h-[1.125rem] w-[1.125rem]" />}
          />
          <ToolbarButton
            label="Save"
            onClick={saveImage}
            icon={<IconDownload className="h-[1.125rem] w-[1.125rem]" />}
          />
          {isDesktop && (
            <ToolbarButton
              label="Reveal"
              onClick={revealInExplorer}
              icon={<IconFolder className="h-[1.125rem] w-[1.125rem]" />}
            />
          )}
          <ToolbarButton
            label="Related"
            disabled={similar.length === 0}
            active={relatedOpen}
            onClick={() => setRelatedOpen((v) => !v)}
            icon={<IconRelated className="h-[1.125rem] w-[1.125rem]" />}
          />
          <ToolbarButton
            label="Share"
            onClick={shareImage}
            icon={<IconShare className="h-[1.125rem] w-[1.125rem]" />}
          />
          <ToolbarButton
            label="Next"
            disabled={!hasNext}
            onClick={goNext}
            className="viewer-tool-btn-nav"
            icon={<IconChevronRight className="h-[1.125rem] w-[1.125rem]" />}
          />
          <ToolbarButton
            label="Done"
            onClick={onClose}
            className="viewer-tool-btn-mobile-only"
            icon={<IconClose className="h-[1.125rem] w-[1.125rem]" />}
          />
        </div>
      </footer>

      {toast && (
        <div className="viewer-toast viewer-toast-pop" role="status">
          {toast}
        </div>
      )}

      {albumPickerOpen && (
        <AlbumPicker
          photoIds={[imageId]}
          onClose={() => setAlbumPickerOpen(false)}
          onChanged={onAlbumsChanged}
        />
      )}

      {relatedOpen && similar.length > 0 && (
        <aside
          className="viewer-related panel-slide"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="viewer-related-header">
            <p className="type-heading text-text-primary">Related</p>
            <button
              type="button"
              onClick={() => setRelatedOpen(false)}
              className="viewer-bar-btn"
              aria-label="Close related"
            >
              <IconClose className="h-[1.125rem] w-[1.125rem]" />
            </button>
          </div>
          <div className="viewer-related-grid">
            {similar.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelect(s.id)
                  setRelatedOpen(false)
                }}
                className="viewer-related-thumb"
                aria-label={`Related image ${i + 1}`}
              >
                <img src={thumbUrl(s.id)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </aside>
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  icon,
  onClick,
  disabled,
  active,
  className = '',
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`viewer-tool-btn ${active ? 'viewer-tool-btn-active' : ''} ${className}`}
      aria-label={label}
      {...(active !== undefined ? { 'aria-pressed': active } : {})}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
