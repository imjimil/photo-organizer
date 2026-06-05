import { useEffect, useRef } from 'react'
import type { ImageSummary, SearchResult } from '../api/client'
import { useDragSelect } from '../hooks/useDragSelect'
import { useJustifiedLayout } from '../hooks/useJustifiedLayout'
import { ImageCard } from './ImageCard'

interface PhotoGridProps {
  items: (ImageSummary | SearchResult)[]
  onSelect: (item: ImageSummary | SearchResult) => void
  showMatchKind?: boolean
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
  showMatchKind,
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
  const layout = useJustifiedLayout(items, gridRef)

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
          style={{ height: layout ? layout.containerHeight : undefined }}
          {...(selectable ? drag.gridHandlers : {})}
          onClick={(e) => {
            if (selectionMode) e.stopPropagation()
          }}
        >
          {items.map((item, index) => {
            const box = layout?.boxes[index]
            return (
              <ImageCard
                key={item.id}
                photoId={item.id}
                item={item}
                box={box}
                onClick={() => {
                  if (drag.shouldSuppressClick()) return
                  onSelect(item)
                }}
                showMatchKind={showMatchKind}
                staggerIndex={index < 12 ? index : -1}
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
            )
          })}
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
