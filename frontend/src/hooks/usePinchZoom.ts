import { useCallback, useRef } from 'react'

interface PinchZoomOptions {
  minScale?: number
  maxScale?: number
}

export function usePinchZoom({
  minScale = 1,
  maxScale = 4,
}: PinchZoomOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const translateRef = useRef({ x: 0, y: 0 })
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStartRef = useRef<{
    distance: number
    scale: number
    midX: number
    midY: number
    tx: number
    ty: number
  } | null>(null)
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  )

  const applyTransform = useCallback(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      '[data-zoom-target]',
    )
    if (!el) return
    const { x, y } = translateRef.current
    const s = scaleRef.current
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`
  }, [])

  const reset = useCallback(() => {
    scaleRef.current = 1
    translateRef.current = { x: 0, y: 0 }
    applyTransform()
  }, [applyTransform])

  const clampTranslate = useCallback(() => {
    const container = containerRef.current
    const target = container?.querySelector<HTMLElement>('[data-zoom-target]')
    if (!container || !target) return

    const s = scaleRef.current
    if (s <= 1) {
      translateRef.current = { x: 0, y: 0 }
      return
    }

    const cw = container.clientWidth
    const ch = container.clientHeight
    const tw = target.offsetWidth * s
    const th = target.offsetHeight * s
    const maxX = Math.max(0, (tw - cw) / 2)
    const maxY = Math.max(0, (th - ch) / 2)

    translateRef.current.x = Math.min(maxX, Math.max(-maxX, translateRef.current.x))
    translateRef.current.y = Math.min(maxY, Math.max(-maxY, translateRef.current.y))
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current
      if (!container) return
      container.setPointerCapture(e.pointerId)
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointersRef.current.size === 2) {
        const pts = [...pointersRef.current.values()]
        const dx = pts[1].x - pts[0].x
        const dy = pts[1].y - pts[0].y
        pinchStartRef.current = {
          distance: Math.hypot(dx, dy),
          scale: scaleRef.current,
          midX: (pts[0].x + pts[1].x) / 2,
          midY: (pts[0].y + pts[1].y) / 2,
          tx: translateRef.current.x,
          ty: translateRef.current.y,
        }
        panStartRef.current = null
      } else if (pointersRef.current.size === 1 && scaleRef.current > 1) {
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          tx: translateRef.current.x,
          ty: translateRef.current.y,
        }
      }
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointersRef.current.size === 2 && pinchStartRef.current) {
        const pts = [...pointersRef.current.values()]
        const dx = pts[1].x - pts[0].x
        const dy = pts[1].y - pts[0].y
        const dist = Math.hypot(dx, dy)
        const ratio = dist / pinchStartRef.current.distance
        scaleRef.current = Math.min(
          maxScale,
          Math.max(minScale, pinchStartRef.current.scale * ratio),
        )
        applyTransform()
        return
      }

      if (pointersRef.current.size === 1 && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        translateRef.current = {
          x: panStartRef.current.tx + dx,
          y: panStartRef.current.ty + dy,
        }
        clampTranslate()
        applyTransform()
      }
    },
    [applyTransform, clampTranslate, maxScale, minScale],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId)
      if (pointersRef.current.size < 2) pinchStartRef.current = null
      if (pointersRef.current.size === 0) panStartRef.current = null

      if (scaleRef.current <= 1.02) reset()
      else clampTranslate()
      applyTransform()

      try {
        containerRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    },
    [applyTransform, clampTranslate, reset],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.92 : 1.08
      scaleRef.current = Math.min(
        maxScale,
        Math.max(minScale, scaleRef.current * delta),
      )
      if (scaleRef.current <= 1) reset()
      else {
        clampTranslate()
        applyTransform()
      }
    },
    [applyTransform, clampTranslate, maxScale, minScale, reset],
  )

  const onDoubleClick = useCallback(() => {
    if (scaleRef.current > 1) reset()
    else {
      scaleRef.current = 2
      applyTransform()
    }
  }, [applyTransform, reset])

  return {
    containerRef,
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
      onDoubleClick,
    },
  }
}
