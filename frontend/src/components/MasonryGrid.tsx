import { useEffect, useRef } from 'react'
import type { ImageSummary, SearchResult } from '../api/client'
import { ImageCard } from './ImageCard'

interface MasonryGridProps {
  items: (ImageSummary | SearchResult)[]
  onSelect: (item: ImageSummary | SearchResult) => void
  showSimilarity?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}

export function MasonryGrid({
  items,
  onSelect,
  showSimilarity,
  onLoadMore,
  hasMore,
  loading,
}: MasonryGridProps) {
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const el = sentinel.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) onLoadMore()
      },
      { rootMargin: '400px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [onLoadMore, hasMore, loading])

  const cols =
    'columns-2 sm:columns-3 lg:columns-4 xl:columns-5 masonry gap-3'

  return (
    <>
      <div className={cols}>
        {items.map((item) => (
          <ImageCard
            key={item.id}
            item={item}
            onClick={() => onSelect(item)}
            showSimilarity={showSimilarity}
          />
        ))}
      </div>
      <div ref={sentinel} className="h-8" aria-hidden />
      {loading && (
        <p className="py-8 text-center font-mono text-sm text-text-faint">
          Loading…
        </p>
      )}
      {!hasMore && items.length > 0 && (
        <p className="py-12 text-center text-sm text-text-faint">
          End of library
        </p>
      )}
    </>
  )
}
