import { useCallback, useEffect, useState } from 'react'
import {
  addToAlbum,
  createAlbum,
  getAlbums,
  getAlbumsForPhoto,
  isFavoritesAlbum,
  removeFromAlbum,
  type AlbumSummary,
} from '../api/client'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { IconClose, IconStar } from './ViewerIcons'

interface AlbumPickerProps {
  photoIds: string[]
  onClose: () => void
  onChanged?: () => void
}

export function AlbumPicker({ photoIds, onClose, onChanged }: AlbumPickerProps) {
  const [albums, setAlbums] = useState<AlbumSummary[]>([])
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const dialogRef = useFocusTrap(true, '[data-album-picker-close]')

  const isBulk = photoIds.length > 1
  const primaryId = photoIds[0]
  const sortedAlbums = [...albums].sort((a, b) => {
    const aFav = isFavoritesAlbum(a) ? 0 : 1
    const bFav = isFavoritesAlbum(b) ? 0 : 1
    return aFav - bFav || a.name.localeCompare(b.name)
  })
  const userAlbumCount = albums.filter((album) => !isFavoritesAlbum(album)).length

  const showBanner = (message: string) => {
    setBanner(message)
    window.setTimeout(() => setBanner(null), 2400)
  }

  const reload = useCallback(async () => {
    if (photoIds.length === 1) {
      const [albumList, membership] = await Promise.all([
        getAlbums(),
        getAlbumsForPhoto(primaryId),
      ])
      setAlbums(albumList.albums)
      setMemberIds(new Set(membership.album_ids))
      return
    }
    const albumList = await getAlbums()
    setAlbums(albumList.albums)
    const memberships = await Promise.all(photoIds.map((id) => getAlbumsForPhoto(id)))
    const allInAlbum = (albumId: string) =>
      memberships.every((m) => m.album_ids.includes(albumId))
    setMemberIds(new Set(albumList.albums.filter((a) => allInAlbum(a.id)).map((a) => a.id)))
  }, [photoIds, primaryId])

  useEffect(() => {
    reload().catch(() => {})
  }, [reload])

  const addPhotosToAlbum = async (albumId: string, albumName: string) => {
    for (const id of photoIds) {
      await addToAlbum(albumId, id)
    }
    setMemberIds((prev) => new Set(prev).add(albumId))
    onChanged?.()
    showBanner(
      isBulk
        ? `Added ${photoIds.length} to ${albumName}`
        : `Added to ${albumName}`,
    )
    await reload()
  }

  const removePhotosFromAlbum = async (albumId: string, albumName: string) => {
    for (const id of photoIds) {
      await removeFromAlbum(albumId, id)
    }
    setMemberIds((prev) => {
      const next = new Set(prev)
      next.delete(albumId)
      return next
    })
    onChanged?.()
    showBanner(`Removed from ${albumName}`)
    await reload()
  }

  const toggleAlbum = async (album: AlbumSummary) => {
    setBusy(true)
    setError(null)
    try {
      if (memberIds.has(album.id)) {
        await removePhotosFromAlbum(album.id, album.name)
      } else {
        await addPhotosToAlbum(album.id, album.name)
      }
    } catch {
      setError('Could not update album')
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const album = await createAlbum(name)
      await addPhotosToAlbum(album.id, album.name)
      setNewName('')
      setCreating(false)
    } catch {
      setError('Could not create album')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="album-picker sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add to album"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <div>
            <p className="type-heading text-text-primary">Add to album</p>
            {isBulk && (
              <p className="type-eyebrow mt-0.5 text-text-muted">
                {photoIds.length} photos
              </p>
            )}
          </div>
          <button
            type="button"
            data-album-picker-close
            onClick={onClose}
            className="viewer-bar-btn"
            aria-label="Close"
          >
            <IconClose className="h-[1.125rem] w-[1.125rem]" />
          </button>
        </header>

        {banner && (
          <div className="album-picker-banner" role="status">
            {banner}
          </div>
        )}

        {error && (
          <p className="type-eyebrow px-4 py-2 text-accent" role="alert">
            {error}
          </p>
        )}

        <ul className="album-picker-list">
          {!creating ? (
            <li>
              <button
                type="button"
                className="album-picker-item album-picker-item-new"
                disabled={busy}
                onClick={() => setCreating(true)}
              >
                <span className="album-picker-new-icon" aria-hidden>
                  +
                </span>
                <span>New album</span>
              </button>
            </li>
          ) : (
            <li className="album-picker-create">
              <form onSubmit={handleCreate} className="album-picker-create-form">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Album name"
                  className="album-picker-input"
                  maxLength={120}
                  disabled={busy}
                  autoFocus
                />
                <div className="album-picker-create-actions">
                  <button
                    type="button"
                    className="album-picker-text-btn"
                    onClick={() => {
                      setCreating(false)
                      setNewName('')
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="album-picker-text-btn album-picker-text-btn-accent"
                    disabled={busy || !newName.trim()}
                  >
                    Create
                  </button>
                </div>
              </form>
            </li>
          )}

          {userAlbumCount === 0 && !creating && (
            <li className="type-eyebrow px-4 py-4 text-center text-text-muted">
              No albums yet
            </li>
          )}

          {sortedAlbums.map((album) => {
            const checked = memberIds.has(album.id)
            const favorites = isFavoritesAlbum(album)
            return (
              <li key={album.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleAlbum(album)}
                  className={`album-picker-item ${checked ? 'album-picker-item-active' : ''}`}
                  aria-pressed={checked}
                >
                  <span className={`album-picker-check ${checked ? 'album-picker-check-on' : ''}`} aria-hidden>
                    {checked ? '✓' : favorites ? <IconStar className="h-3.5 w-3.5" filled /> : ''}
                  </span>
                  <span className="truncate">{album.name}</span>
                  <span className="type-eyebrow tabular-nums text-text-muted">
                    {album.count}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
