import { useEffect } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface NewAlbumSheetProps {
  name: string
  onNameChange: (name: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function NewAlbumSheet({ name, onNameChange, onSubmit, onClose }: NewAlbumSheetProps) {
  const dialogRef = useFocusTrap(true, '.album-picker-input')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="album-sheet sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="New album"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <p className="type-heading text-text-primary">New album</p>
        </header>
        <form onSubmit={onSubmit} className="album-picker-create px-4 pb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Album name"
            className="album-picker-input"
            maxLength={120}
            autoFocus
          />
          <div className="album-picker-create-actions mt-3">
            <button type="button" className="album-picker-text-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="album-picker-text-btn album-picker-text-btn-accent"
              disabled={!name.trim()}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
