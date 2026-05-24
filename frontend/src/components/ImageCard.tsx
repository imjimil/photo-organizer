import type { ImageSummary, SearchResult } from '../api/client'
import { thumbUrl } from '../api/client'

interface ImageCardProps {
  item: ImageSummary | SearchResult
  onClick: () => void
  showSimilarity?: boolean
}

export function ImageCard({ item, onClick, showSimilarity }: ImageCardProps) {
  const similarity =
    'similarity' in item ? (item as SearchResult).similarity : undefined

  return (
    <article className="masonry-item group cursor-pointer">
      <button
        type="button"
        onClick={onClick}
        className="block w-full overflow-hidden rounded-md text-left transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <div className="relative overflow-hidden rounded-md bg-bg-elevated">
          <img
            src={thumbUrl(item.id)}
            alt=""
            loading="lazy"
            className="block w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {showSimilarity && similarity !== undefined && (
            <span className="absolute right-2 top-2 rounded bg-bg-base/90 px-2 py-0.5 font-mono text-[11px] text-accent backdrop-blur-sm">
              {(similarity * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {item.ocr_preview ? (
          <p className="font-quote mt-2 line-clamp-2 text-[13px] leading-snug text-text-muted group-hover:text-text-primary">
            {item.ocr_preview}
          </p>
        ) : (
          <p className="mt-2 font-mono text-[11px] text-text-faint">
            visual
          </p>
        )}
      </button>
    </article>
  )
}
