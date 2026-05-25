import { useCallback, useEffect, useRef, useState } from 'react'

const DRAG_THRESHOLD_MOUSE_PX = 6
const DRAG_THRESHOLD_TOUCH_PX = 10
const LONG_PRESS_MS = 420
const SCROLL_CANCEL_PX = 12

interface UseDragSelectOptions {
  enabled: boolean
  selectionMode: boolean
  selectedIds: Set<string>
  orderedIds: string[]
  onBeginSelection: (id: string) => void
  onSelectId: (id: string) => void
  onDeselectId: (id: string) => void
}

function photoIdFromPoint(x: number, y: number): string | null {
  const elements = document.elementsFromPoint(x, y)
  for (const el of elements) {
    const wrap = (el as HTMLElement).closest?.('[data-photo-id]')
    if (wrap) return wrap.getAttribute('data-photo-id')
  }
  return null
}

export function useDragSelect({
  enabled,
  selectionMode,
  selectedIds,
  orderedIds,
  onBeginSelection,
  onSelectId,
  onDeselectId,
}: UseDragSelectOptions) {
  const dragging = useRef(false)
  const dragMode = useRef<'select' | 'deselect'>('select')
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const startId = useRef<string | null>(null)
  const startIndexRef = useRef(-1)
  const lastEndIdRef = useRef<string | null>(null)
  const baselineRef = useRef<Set<string>>(new Set())
  const lastRangeRef = useRef<Set<string>>(new Set())
  const suppressClick = useRef(false)
  const sessionActive = useRef(false)
  const gridEl = useRef<HTMLElement | null>(null)
  const activePointerId = useRef<number | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const pointerType = useRef<'mouse' | 'touch' | 'pen'>('mouse')

  const selectionModeRef = useRef(selectionMode)
  const selectedIdsRef = useRef(selectedIds)
  const orderedIdsRef = useRef(orderedIds)
  const onBeginSelectionRef = useRef(onBeginSelection)
  const onSelectIdRef = useRef(onSelectId)
  const onDeselectIdRef = useRef(onDeselectId)

  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    selectionModeRef.current = selectionMode
    selectedIdsRef.current = selectedIds
    orderedIdsRef.current = orderedIds
    onBeginSelectionRef.current = onBeginSelection
    onSelectIdRef.current = onSelectId
    onDeselectIdRef.current = onDeselectId
  }, [selectionMode, selectedIds, orderedIds, onBeginSelection, onSelectId, onDeselectId])

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const indexOf = useCallback((id: string) => orderedIdsRef.current.indexOf(id), [])

  const applyRange = useCallback(
    (endId: string) => {
      const startIdx = startIndexRef.current
      const endIdx = indexOf(endId)
      if (startIdx < 0 || endIdx < 0) return

      const lo = Math.min(startIdx, endIdx)
      const hi = Math.max(startIdx, endIdx)
      const nextRange = new Set(orderedIdsRef.current.slice(lo, hi + 1))

      if (dragMode.current === 'select') {
        for (const id of nextRange) onSelectIdRef.current(id)
        for (const id of lastRangeRef.current) {
          if (!nextRange.has(id) && !baselineRef.current.has(id)) {
            onDeselectIdRef.current(id)
          }
        }
      } else {
        for (const id of nextRange) onDeselectIdRef.current(id)
        for (const id of lastRangeRef.current) {
          if (!nextRange.has(id) && baselineRef.current.has(id)) {
            onSelectIdRef.current(id)
          }
        }
      }

      lastRangeRef.current = nextRange
      lastEndIdRef.current = endId
    },
    [indexOf],
  )

  const startDrag = useCallback(
    (id: string) => {
      dragging.current = true
      setIsDragging(true)
      baselineRef.current = new Set(selectedIdsRef.current)
      lastRangeRef.current = new Set()
      startIndexRef.current = indexOf(id)
      lastEndIdRef.current = id
      dragMode.current = selectedIdsRef.current.has(id) ? 'deselect' : 'select'
      if (!selectionModeRef.current) onBeginSelectionRef.current(id)
      applyRange(id)
    },
    [applyRange, indexOf],
  )

  const releaseCapture = useCallback(() => {
    const el = gridEl.current
    const id = activePointerId.current
    if (el && id !== null && el.hasPointerCapture?.(id)) {
      try {
        el.releasePointerCapture(id)
      } catch {
        /* already released */
      }
    }
    activePointerId.current = null
    gridEl.current = null
  }, [])

  const endSession = useCallback(() => {
    clearLongPress()
    if (dragging.current || longPressFired.current) suppressClick.current = true
    dragging.current = false
    setIsDragging(false)
    longPressFired.current = false
    startPoint.current = null
    startId.current = null
    startIndexRef.current = -1
    lastEndIdRef.current = null
    lastRangeRef.current = new Set()
    sessionActive.current = false
    releaseCapture()
  }, [clearLongPress, releaseCapture])

  const onWindowMove = useCallback(
    (e: PointerEvent) => {
      if (!sessionActive.current || !startPoint.current || !startId.current) return

      const dx = e.clientX - startPoint.current.x
      const dy = e.clientY - startPoint.current.y
      const dist = Math.hypot(dx, dy)

      if (!dragging.current) {
        if (
          pointerType.current === 'touch' &&
          !selectionModeRef.current &&
          !longPressFired.current &&
          dist >= SCROLL_CANCEL_PX
        ) {
          clearLongPress()
          sessionActive.current = false
          startPoint.current = null
          startId.current = null
          return
        }

        const threshold =
          pointerType.current === 'mouse'
            ? DRAG_THRESHOLD_MOUSE_PX
            : DRAG_THRESHOLD_TOUCH_PX

        if (dist >= threshold && (selectionModeRef.current || pointerType.current === 'mouse')) {
          clearLongPress()
          startDrag(startId.current)
          activePointerId.current = e.pointerId
          gridEl.current?.setPointerCapture?.(e.pointerId)
        }
      }

      if (dragging.current) {
        e.preventDefault()
        const endId = photoIdFromPoint(e.clientX, e.clientY) ?? lastEndIdRef.current
        if (endId) applyRange(endId)
      }
    },
    [applyRange, clearLongPress, startDrag],
  )

  const onWindowUp = useCallback(() => {
    endSession()
    window.removeEventListener('pointermove', onWindowMove)
    window.removeEventListener('pointerup', onWindowUp)
    window.removeEventListener('pointercancel', onWindowUp)
  }, [endSession, onWindowMove])

  useEffect(() => {
    return () => {
      clearLongPress()
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      window.removeEventListener('pointercancel', onWindowUp)
    }
  }, [clearLongPress, onWindowMove, onWindowUp])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || e.button !== 0) return

      const id = photoIdFromPoint(e.clientX, e.clientY)
      if (!id) return

      gridEl.current = e.currentTarget as HTMLElement
      pointerType.current =
        e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse'

      suppressClick.current = false
      longPressFired.current = false
      startPoint.current = { x: e.clientX, y: e.clientY }
      startId.current = id
      dragging.current = false
      sessionActive.current = true
      clearLongPress()

      if (selectionModeRef.current) {
        startDrag(id)
        activePointerId.current = e.pointerId
        gridEl.current.setPointerCapture(e.pointerId)
      } else if (pointerType.current === 'touch') {
        longPressTimer.current = window.setTimeout(() => {
          longPressFired.current = true
          if (navigator.vibrate) navigator.vibrate(12)
          startDrag(startId.current!)
          activePointerId.current = e.pointerId
          gridEl.current?.setPointerCapture?.(e.pointerId)
        }, LONG_PRESS_MS)
      }

      window.addEventListener('pointermove', onWindowMove, { passive: false })
      window.addEventListener('pointerup', onWindowUp)
      window.addEventListener('pointercancel', onWindowUp)
    },
    [clearLongPress, enabled, onWindowMove, onWindowUp, startDrag],
  )

  const shouldSuppressClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false
      return true
    }
    return false
  }, [])

  return {
    gridHandlers: { onPointerDownCapture: onPointerDown },
    shouldSuppressClick,
    isDragging,
  }
}
