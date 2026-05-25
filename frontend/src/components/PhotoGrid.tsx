import { useEffect, useRef } from 'react'
import type { ImageSummary, SearchResult } from '../api/client'
import { ImageCard } from './ImageCard'

interface PhotoGridProps {
  items: (ImageSummary | SearchResult)[]
  onSelect: (item: ImageSummary | SearchResult) => void
  showSimilarity?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}

export function PhotoGrid({
  items,
  onSelect,
  showSimilarity,
  onLoadMore,
  hasMore,
  loading,
}: PhotoGridProps) {
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const el = sentinel.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) onLoadMore()
      },
      { rootMargin: '600px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [onLoadMore, hasMore, loading])

  return (
    <>
      <div className="photo-grid">
        {items.map((item, index) => (
          <ImageCard
            key={item.id}
            item={item}
            onClick={() => onSelect(item)}
            showSimilarity={showSimilarity}
            staggerIndex={index}
          />
        ))}
      </div>
      <div ref={sentinel} className="h-px" aria-hidden />
      {loading && items.length > 0 && (
        <p className="type-eyebrow pulse-soft py-8 text-center" aria-live="polite">
          Loading more
        </p>
      )}
    </>
  )
}
