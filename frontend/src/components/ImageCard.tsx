import type { ImageSummary, SearchResult } from '../api/client'
import { thumbUrl } from '../api/client'
import { imageAriaLabel } from '../utils/imageLabel'

interface ImageCardProps {
  photoId: string
  item: ImageSummary | SearchResult
  onClick: () => void
  showSimilarity?: boolean
  staggerIndex?: number
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onBeginSelection?: () => void
  selectable?: boolean
}

export function ImageCard({
  photoId,
  item,
  onClick,
  showSimilarity,
  staggerIndex = 0,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onBeginSelection,
  selectable = false,
}: ImageCardProps) {
  const similarity =
    'similarity' in item ? (item as SearchResult).similarity : undefined

  const handleOpen = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect()
      return
    }
    onClick()
  }

  const handleSelectTap = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onBeginSelection?.()
  }

  const animate = staggerIndex >= 0 && staggerIndex < 20

  return (
    <div
      data-photo-id={photoId}
      className={`photo-tile-wrap group ${animate ? '' : 'photo-tile-wrap-static'} ${selectionMode ? 'photo-tile-wrap-selecting' : ''} ${selected ? 'photo-tile-wrap-selected' : ''}`}
      style={
        animate ? { animationDelay: `${staggerIndex * 30}ms` } : undefined
      }
    >
      <button
        type="button"
        onClick={handleOpen}
        className={`photo-tile ${selected ? 'photo-tile-selected' : ''}`}
        aria-label={imageAriaLabel(item)}
        aria-pressed={selectionMode ? selected : undefined}
      >
        <img
          src={thumbUrl(item.id)}
          alt=""
          loading="lazy"
          decoding="async"
          className="photo-tile-img"
          draggable={false}
        />
        {selectionMode && (
          <span
            className={`photo-select-mark ${selected ? 'photo-select-mark-on' : ''}`}
            aria-hidden
          >
            {selected ? '✓' : ''}
          </span>
        )}
        {selected && selectionMode && <span className="photo-select-overlay" aria-hidden />}
        {showSimilarity && similarity !== undefined && (
          <span className="photo-similarity-badge">
            {(similarity * 100).toFixed(0)}
          </span>
        )}
      </button>

      {selectable && !selectionMode && onBeginSelection && (
        <button
          type="button"
          className="photo-select-hover"
          aria-label="Select photo"
          onClick={handleSelectTap}
        />
      )}
    </div>
  )
}
