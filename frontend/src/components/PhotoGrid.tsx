import { useEffect, useRef } from 'react'
import type { ImageSummary, SearchResult } from '../api/client'
import { useDragSelect } from '../hooks/useDragSelect'
import { ImageCard } from './ImageCard'

interface PhotoGridProps {
  items: (ImageSummary | SearchResult)[]
  onSelect: (item: ImageSummary | SearchResult) => void
  showSimilarity?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onBeginSelection?: (id: string) => void
  onSelectId?: (id: string) => void
  onDeselectId?: (id: string) => void
  selectable?: boolean
  error?: boolean
  onRetry?: () => void
}

export function PhotoGrid({
  items,
  onSelect,
  showSimilarity,
  onLoadMore,
  hasMore,
  loading,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onBeginSelection,
  onSelectId,
  onDeselectId,
  selectable = false,
  error = false,
  onRetry,
}: PhotoGridProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const drag = useDragSelect({
    enabled: selectable && Boolean(onBeginSelection && onSelectId && onDeselectId),
    selectionMode,
    selectedIds: selectedIds ?? new Set(),
    orderedIds: items.map((item) => item.id),
    onBeginSelection: onBeginSelection ?? (() => {}),
    onSelectId: onSelectId ?? (() => {}),
    onDeselectId: onDeselectId ?? (() => {}),
  })

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
      {error && (
        <p className="type-caption mx-auto max-w-sm px-4 py-20 text-center text-text-muted">
          Couldn&apos;t load photos.{' '}
          {onRetry && (
            <button type="button" className="feed-retry-btn" onClick={onRetry}>
              Try again
            </button>
          )}
        </p>
      )}
      {!error && (
      <div
        ref={gridRef}
        className={`photo-grid ${selectionMode ? 'photo-grid-selecting' : ''} ${selectable ? 'photo-grid-selectable' : ''}`}
        {...(selectable ? drag.gridHandlers : {})}
        style={{ touchAction: selectionMode || drag.isDragging ? 'none' : 'pan-y' }}
        onClick={(e) => {
          if (selectionMode) e.stopPropagation()
        }}
      >
        {items.map((item, index) => (
          <ImageCard
            key={item.id}
            photoId={item.id}
            item={item}
            onClick={() => {
              if (drag.shouldSuppressClick()) return
              onSelect(item)
            }}
            showSimilarity={showSimilarity}
            staggerIndex={index < 20 ? index : -1}
            selectionMode={selectionMode}
            selected={selectedIds?.has(item.id) ?? false}
            onToggleSelect={
              onToggleSelect ? () => onToggleSelect(item.id) : undefined
            }
            onBeginSelection={
              onBeginSelection ? () => onBeginSelection(item.id) : undefined
            }
            selectable={selectable}
          />
        ))}
      </div>
      )}
      <div ref={sentinel} className="h-px" aria-hidden />
      {!error && loading && items.length === 0 && (
        <p className="type-eyebrow pulse-soft py-16 text-center" aria-live="polite">
          Loading
        </p>
      )}
      {!error && loading && items.length > 0 && (
        <p className="type-eyebrow pulse-soft py-8 text-center" aria-live="polite">
          Loading more
        </p>
      )}
    </>
  )
}
