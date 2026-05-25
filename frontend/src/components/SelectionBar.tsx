import { IconAlbum, IconCheck } from './ViewerIcons'
import { BackButton } from './BackButton'
interface SelectionBarProps {
  count: number
  total?: number
  onAddToAlbum: () => void
  onSelectAll: () => void
  onClear: () => void
  onDone: () => void
  showBack?: boolean
  onBack?: () => void
  backLabel?: string
}

export function SelectionBar({
  count,
  total = 0,
  onAddToAlbum,
  onSelectAll,
  onClear,
  onDone,
  showBack = false,
  onBack,
  backLabel,
}: SelectionBarProps) {
  const allSelected = total > 0 && count >= total

  return (
    <div className="selection-bar-wrap" role="region" aria-label="Photo selection">
      <div className="selection-bar" role="toolbar" aria-label="Selection actions">
        <div className="selection-bar-leading">
          {showBack && onBack && (
            <BackButton compact onClick={onBack} label={backLabel} />
          )}          <button type="button" className="selection-bar-done" onClick={onDone}>
            <IconCheck className="h-4 w-4" />
            Done
          </button>
          <p className="selection-bar-count type-eyebrow tabular-nums">
            {count > 0 ? `${count.toLocaleString()} selected` : 'Select photos'}
          </p>
        </div>
        <div className="selection-bar-actions">
          <button
            type="button"
            className="selection-action-btn selection-action-btn-primary"
            onClick={onAddToAlbum}
            disabled={count === 0}
          >
            <IconAlbum className="h-[1.125rem] w-[1.125rem]" />
            Add to album
          </button>
          {total > 0 && (
            <button
              type="button"
              className="selection-action-btn"
              onClick={allSelected ? onClear : onSelectAll}
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
