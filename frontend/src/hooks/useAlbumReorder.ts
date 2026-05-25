import { useCallback, useEffect, useRef, useState } from 'react'
import { clearFlipTransforms } from './useFlipList'

export interface DragVisual {
  id: string
  width: number
  height: number
}

function moveToIndex<T extends { id: string }>(items: T[], activeId: string, toIndex: number): T[] {
  const fromIndex = items.findIndex((item) => item.id === activeId)
  if (fromIndex < 0 || fromIndex === toIndex) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  const clamped = Math.max(0, Math.min(toIndex, next.length))
  next.splice(clamped, 0, moved)
  return next
}

function targetIndexFromPoint(
  container: HTMLElement,
  orderedIds: string[],
  draggingId: string,
  x: number,
  y: number,
): number | null {
  let closestIndex = -1
  let closestDist = Infinity
  let closestRect: DOMRect | null = null

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]
    const slot = container.querySelector<HTMLElement>(`[data-album-slot="${id}"]`)
    if (!slot) continue

    const rect = slot.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dist = (x - cx) ** 2 + (y - cy) ** 2
    if (dist < closestDist) {
      closestDist = dist
      closestIndex = i
      closestRect = rect
    }
  }

  if (closestIndex < 0 || !closestRect) return null

  let target = closestIndex
  if (x > closestRect.left + closestRect.width / 2) {
    target = closestIndex + 1
  }

  const fromIndex = orderedIds.indexOf(draggingId)
  if (fromIndex >= 0 && target > fromIndex) {
    target -= 1
  }

  return Math.max(0, Math.min(target, orderedIds.length - 1))
}

export function useAlbumReorder<T extends { id: string }>(
  items: T[],
  gridRef: React.RefObject<HTMLElement | null>,
  onCommit: (orderedIds: string[]) => void | Promise<void>,
) {
  const [orderedItems, setOrderedItems] = useState(items)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)
  const orderedRef = useRef(orderedItems)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const draggingIdRef = useRef<string | null>(null)
  const grabOffsetRef = useRef({ x: 0, y: 0 })
  const lastTargetIndexRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    if (draggingRef.current) return
    setOrderedItems((prev) => {
      const prevKey = prev.map((item) => item.id).join(',')
      const nextKey = items.map((item) => item.id).join(',')
      if (prevKey !== nextKey) return items
      const lookup = new Map(items.map((item) => [item.id, item]))
      return prev.map((item) => lookup.get(item.id) ?? item)
    })
  }, [items])

  useEffect(() => {
    orderedRef.current = orderedItems
  }, [orderedItems])

  const updateOverlayPosition = useCallback((x: number, y: number) => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }, [])

  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const commitOrder = useCallback(async () => {
    const ids = orderedRef.current.map((item) => item.id)
    const serverKey = itemsRef.current.map((item) => item.id).join(',')
    if (ids.join(',') === serverKey) return
    try {
      await onCommit(ids)
    } catch {
      setOrderedItems(itemsRef.current)
    }
  }, [onCommit])

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    draggingIdRef.current = null
    lastTargetIndexRef.current = null
    suppressClickRef.current = true
    setDraggingId(null)
    setDragVisual(null)
    document.body.classList.remove('album-drag-active')
    clearFlipTransforms(gridRef.current)
    void commitOrder()
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }, [commitOrder, gridRef])

  const handlePointerDown = useCallback(
    (id: string, event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()

      const gridItem = event.currentTarget.closest('[data-album-slot]') as HTMLElement | null
      if (!gridItem || !gridRef.current) return

      clearFlipTransforms(gridRef.current)

      const rect = gridItem.getBoundingClientRect()

      grabOffsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      const fromIndex = orderedRef.current.findIndex((item) => item.id === id)
      lastTargetIndexRef.current = fromIndex >= 0 ? fromIndex : null

      draggingRef.current = true
      draggingIdRef.current = id
      setDraggingId(id)
      setDragVisual({
        id,
        width: rect.width,
        height: rect.height,
      })
      document.body.classList.add('album-drag-active')

      requestAnimationFrame(() => {
        updateOverlayPosition(
          event.clientX - grabOffsetRef.current.x,
          event.clientY - grabOffsetRef.current.y,
        )
      })

      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [gridRef, updateOverlayPosition],
  )

  useEffect(() => {
    if (!draggingId) return

    const onPointerMove = (event: PointerEvent) => {
      if (!draggingRef.current || !draggingIdRef.current) return

      const x = event.clientX - grabOffsetRef.current.x
      const y = event.clientY - grabOffsetRef.current.y
      updateOverlayPosition(x, y)

      const container = gridRef.current
      const activeId = draggingIdRef.current
      if (!container || !activeId) return

      const orderedIds = orderedRef.current.map((item) => item.id)
      const targetIndex = targetIndexFromPoint(container, orderedIds, activeId, event.clientX, event.clientY)
      if (targetIndex === null || targetIndex === lastTargetIndexRef.current) return

      lastTargetIndexRef.current = targetIndex
      setOrderedItems((prev) => moveToIndex(prev, activeId, targetIndex))
    }

    const onPointerUp = () => finishDrag()
    const onPointerCancel = () => finishDrag()

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [draggingId, finishDrag, gridRef, updateOverlayPosition])

  const shouldSuppressClick = useCallback(() => suppressClickRef.current, [])

  return {
    orderedItems,
    draggingId,
    dragVisual,
    overlayRef,
    handlePointerDown,
    shouldSuppressClick,
  }
}
