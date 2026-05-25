import type { ImageSummary, SearchResult } from '../api/client'
import { thumbUrl } from '../api/client'
import { imageAriaLabel } from '../utils/imageLabel'

interface ImageCardProps {
  item: ImageSummary | SearchResult
  onClick: () => void
  showSimilarity?: boolean
  staggerIndex?: number
}

export function ImageCard({
  item,
  onClick,
  showSimilarity,
  staggerIndex = 0,
}: ImageCardProps) {
  const similarity =
    'similarity' in item ? (item as SearchResult).similarity : undefined

  return (
    <button
      type="button"
      onClick={onClick}
      className="photo-tile group relative block aspect-square w-full"
      style={{
        animationDelay: staggerIndex < 12 ? `${staggerIndex * 30}ms` : '0ms',
      }}
      aria-label={imageAriaLabel(item)}
    >
      <img
        src={thumbUrl(item.id)}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {showSimilarity && similarity !== undefined && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-bg-surface/90 px-2 py-0.5 font-mono text-[10px] text-accent">
          {(similarity * 100).toFixed(0)}
        </span>
      )}
    </button>
  )
}
