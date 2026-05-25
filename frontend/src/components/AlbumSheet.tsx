import { useState } from 'react'
import {
  deleteAlbum,
  isFavoritesAlbum,
  renameAlbum,
  setAlbumCover,
  type AlbumSummary,
} from '../api/client'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { IconClose } from './ViewerIcons'

interface AlbumSheetProps {
  album: AlbumSummary
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

export function AlbumSheet({ album, onClose, onUpdated, onDeleted }: AlbumSheetProps) {
  const [name, setName] = useState(album.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useFocusTrap(true, '[data-album-sheet-close]')
  const systemAlbum = isFavoritesAlbum(album)

  if (systemAlbum) {
    return (
      <div className="sheet-scrim" onClick={onClose} role="presentation">
        <div
          ref={dialogRef}
          className="album-sheet sheet-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Favorites album"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="sheet-header">
            <p className="type-heading text-text-primary">Favorites</p>
            <button
              type="button"
              data-album-sheet-close
              onClick={onClose}
              className="viewer-bar-btn"
              aria-label="Close"
            >
              <IconClose className="h-[1.125rem] w-[1.125rem]" />
            </button>
          </header>
          <p className="type-eyebrow px-4 pb-4 text-text-muted">
            Star photos from the viewer to fill this album. It cannot be renamed or deleted.
          </p>
        </div>
      </div>
    )
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === album.name) return
    setBusy(true)
    setError(null)
    try {
      await renameAlbum(album.id, trimmed)
      onUpdated()
      onClose()
    } catch {
      setError('Could not rename album')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${album.name}"? Photos stay in your library.`)) return
    setBusy(true)
    try {
      await deleteAlbum(album.id)
      onDeleted()
      onClose()
    } catch {
      setError('Could not delete album')
    } finally {
      setBusy(false)
    }
  }

  const handleSetCover = async () => {
    if (!album.cover_photo_id) return
    setBusy(true)
    try {
      await setAlbumCover(album.id, album.cover_photo_id)
      onUpdated()
    } catch {
      setError('Could not update cover')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="album-sheet sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Album settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <p className="type-heading text-text-primary">Album</p>
          <button
            type="button"
            data-album-sheet-close
            onClick={onClose}
            className="viewer-bar-btn"
            aria-label="Close"
          >
            <IconClose className="h-[1.125rem] w-[1.125rem]" />
          </button>
        </header>

        <form onSubmit={handleRename} className="album-create-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="search-input flex-1"
            maxLength={120}
            disabled={busy}
          />
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={busy || !name.trim() || name.trim() === album.name}
          >
            Save
          </button>
        </form>

        <p className="type-eyebrow px-4 py-2 text-text-muted">
          {album.count.toLocaleString()} images
        </p>

        {error && (
          <p className="type-eyebrow px-4 py-2 text-accent" role="alert">
            {error}
          </p>
        )}

        <div className="album-sheet-actions">
          {album.cover_photo_id && (
            <button type="button" className="viewer-bar-btn" onClick={handleSetCover} disabled={busy}>
              Refresh cover from latest
            </button>
          )}
          <button type="button" className="album-delete-btn" onClick={handleDelete} disabled={busy}>
            Delete album
          </button>
        </div>
      </div>
    </div>
  )
}
