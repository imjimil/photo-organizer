import { useCallback, useEffect, useRef, useState } from 'react'
import { discover, mediaUrl, type ImageSummary } from '../api/client'
import { imageAltText } from '../utils/imageLabel'

const DECK_SIZE = 8
const PREFETCH_THRESHOLD = 3
const SWIPE_THRESHOLD_PX = 64
const SWIPE_COMMIT_MS = 340

interface DiscoverViewProps {
  onOpen: (id: string) => void
}

type CommitDir = 'next' | 'prev'

export function DiscoverView({ onOpen }: DiscoverViewProps) {
  const [deck, setDeck] = useState<ImageSummary[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [prefetching, setPrefetching] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [committing, setCommitting] = useState(false)
  const [skipTransition, setSkipTransition] = useState(false)
  const [dragging, setDragging] = useState(false)

  const seenRef = useRef<Set<string>>(new Set())
  const deckRef = useRef<HTMLDivElement>(null)
  const deckWidthRef = useRef(320)
  const pointerRef = useRef<{ x: number; y: number; active: boolean; id: number } | null>(null)
  const dragXRef = useRef(0)
  const committingRef = useRef(false)
  const suppressTapRef = useRef(false)
  const nextRef = useRef<ImageSummary | null>(null)
  const prevRef = useRef<ImageSummary | null>(null)
  const finishCommitRef = useRef<(dir: CommitDir) => void>(() => {})
  const resetDragRef = useRef<(instant?: boolean) => void>(() => {})

  const current = deck[index] ?? null
  const next = deck[index + 1] ?? null
  const prev = index > 0 ? deck[index - 1] : null

  useEffect(() => {
    nextRef.current = next
    prevRef.current = prev
  }, [next, prev])

  useEffect(() => {
    const el = deckRef.current
    if (!el) return
    const syncWidth = () => {
      deckWidthRef.current = el.offsetWidth || 320
    }
    syncWidth()
    const ro = new ResizeObserver(syncWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading, current?.id])

  const appendToDeck = useCallback((items: ImageSummary[]) => {
    if (items.length === 0) return
    items.forEach((item) => seenRef.current.add(item.id))
    setDeck((prevDeck) => [...prevDeck, ...items])
  }, [])

  const fetchMore = useCallback(async (reset = false) => {
    if (prefetching) return
    setPrefetching(true)
    try {
      const exclude = reset ? [] : [...seenRef.current]
      const data = await discover(DECK_SIZE, exclude)
      let fresh = data.items.filter((item) => !seenRef.current.has(item.id))
      if (fresh.length === 0 && !reset) {
        seenRef.current.clear()
        const retry = await discover(DECK_SIZE, [])
        fresh = retry.items
      }
      if (reset) {
        fresh.forEach((item) => seenRef.current.add(item.id))
        setDeck(fresh)
        setIndex(0)
      } else {
        appendToDeck(fresh)
      }
    } finally {
      setPrefetching(false)
    }
  }, [appendToDeck, prefetching])

  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      seenRef.current.clear()
      try {
        const data = await discover(DECK_SIZE, [])
        if (cancelled) return
        data.items.forEach((item) => seenRef.current.add(item.id))
        setDeck(data.items)
        setIndex(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading || deck.length === 0) return
    if (deck.length - index <= PREFETCH_THRESHOLD) {
      fetchMore().catch(() => {})
    }
  }, [deck.length, index, loading, fetchMore])

  const resetDrag = useCallback((instant = false) => {
    if (instant) {
      setSkipTransition(true)
      dragXRef.current = 0
      setDragX(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSkipTransition(false))
      })
      return
    }
    dragXRef.current = 0
    setDragX(0)
  }, [])

  const finishCommit = useCallback(
    (dir: CommitDir) => {
      if (committingRef.current || !current) return
      if (dir === 'next' && !next) return
      if (dir === 'prev' && !prev) return

      committingRef.current = true
      setCommitting(true)

      const width = deckWidthRef.current
      const target = dir === 'next' ? -width : width
      dragXRef.current = target
      setDragX(target)

      window.setTimeout(() => {
        setSkipTransition(true)
        setIndex((i) => (dir === 'next' ? i + 1 : i - 1))
        dragXRef.current = 0
        setDragX(0)
        committingRef.current = false
        setCommitting(false)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setSkipTransition(false))
        })
      }, SWIPE_COMMIT_MS)
    },
    [current, next, prev],
  )

  const advance = useCallback(() => {
    finishCommit('next')
  }, [finishCommit])

  const handleCardTap = () => {
    if (suppressTapRef.current) {
      suppressTapRef.current = false
      return
    }
    advance()
  }

  const goBack = useCallback(() => {
    finishCommit('prev')
  }, [finishCommit])

  useEffect(() => {
    finishCommitRef.current = finishCommit
    resetDragRef.current = resetDrag
  }, [finishCommit, resetDrag])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        advance()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, goBack])

  useEffect(() => {
    const el = deckRef.current
    if (!el) return

    const applyDrag = (dx: number) => {
      let nextX = dx
      if (dx > 0 && !prevRef.current) nextX = dx * 0.22
      if (dx < 0 && !nextRef.current) nextX = dx * 0.22
      dragXRef.current = nextX
      setDragX(nextX)
    }

    const releaseCapture = (pointerId: number) => {
      if (el.hasPointerCapture(pointerId)) {
        try {
          el.releasePointerCapture(pointerId)
        } catch {
          /* already released */
        }
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (committingRef.current || e.button !== 0) return
      pointerRef.current = { x: e.clientX, y: e.clientY, active: false, id: e.pointerId }
      el.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const start = pointerRef.current
      if (!start || committingRef.current || e.pointerId !== start.id) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y

      if (!start.active) {
        if (Math.hypot(dx, dy) < 8) return
        if (Math.abs(dy) > Math.abs(dx)) {
          if (e.pointerType === 'touch') {
            pointerRef.current = null
            releaseCapture(e.pointerId)
          }
          return
        }
        start.active = true
        setDragging(true)
      }

      e.preventDefault()
      applyDrag(dx)
    }

    const onPointerUp = (e: PointerEvent) => {
      const start = pointerRef.current
      if (!start || e.pointerId !== start.id) return
      pointerRef.current = null
      releaseCapture(e.pointerId)

      if (!start.active || committingRef.current) return

      setDragging(false)
      const dx = dragXRef.current
      if (Math.abs(dx) > 10) suppressTapRef.current = true
      if (dx <= -SWIPE_THRESHOLD_PX && nextRef.current) {
        finishCommitRef.current('next')
      } else if (dx >= SWIPE_THRESHOLD_PX && prevRef.current) {
        finishCommitRef.current('prev')
      } else {
        resetDragRef.current()
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [loading, current?.id])

  const width = deckWidthRef.current
  const nextProgress =
    dragX < 0 ? Math.min(1, Math.abs(dragX) / Math.max(width, 1)) : 0
  const prevProgress =
    dragX > 0 ? Math.min(1, dragX / Math.max(width, 1)) : 0

  const underItem =
    dragX < 0 && next ? next : dragX > 0 && prev ? prev : next
  const underProgress = dragX < 0 ? nextProgress : dragX > 0 ? prevProgress : 0
  const showUnder = Boolean(underItem && (dragX !== 0 || committing))

  const frontStyle: React.CSSProperties = {
    transform: `translateX(${dragX}px) rotate(${dragX * 0.035}deg)`,
    transition: skipTransition || dragging
      ? 'none'
      : `transform ${SWIPE_COMMIT_MS}ms var(--ease-expo), opacity ${SWIPE_COMMIT_MS}ms var(--ease-expo)`,
    opacity: 1 - Math.min(0.35, Math.abs(dragX) / Math.max(width, 1) * 0.35),
  }

  const underStyle: React.CSSProperties = {
    transform: `scale(${0.92 + underProgress * 0.08}) translateY(${(1 - underProgress) * 10}px)`,
    opacity: 0.45 + underProgress * 0.55,
    transition:
      skipTransition || dragging
        ? 'none'
        : `transform ${SWIPE_COMMIT_MS}ms var(--ease-expo), opacity ${SWIPE_COMMIT_MS}ms var(--ease-expo)`,
  }

  if (loading && !current) {
    return (
      <main id="main-content" className="discover-stage">
        <p className="type-eyebrow pulse-soft text-text-muted">Finding something new</p>
      </main>
    )
  }

  return (
    <main id="main-content" className="discover-stage">
      <div className="discover-copy">
        <p className="type-eyebrow text-text-muted">Discover</p>
        <p className="type-quote mt-2 text-text-primary">
          Tap, drag, or swipe for another surprise
        </p>
      </div>

      <div ref={deckRef} className={`discover-deck ${dragging ? 'discover-deck-dragging' : ''}`}>
        {showUnder && underItem && (
          <div className="discover-card discover-card-under" style={underStyle} aria-hidden>
            <img
              src={mediaUrl(underItem.id)}
              alt=""
              draggable={false}
              className="discover-image"
            />
          </div>
        )}
        {!showUnder && next && (
          <div className="discover-card discover-card-idle" aria-hidden>
            <img
              src={mediaUrl(next.id)}
              alt=""
              draggable={false}
              className="discover-image"
            />
          </div>
        )}
        {current && (
          <button
            type="button"
            onClick={handleCardTap}
            disabled={committing}
            className="discover-card discover-card-front discover-card-live"
            style={frontStyle}
            aria-label={current ? `Open ${imageAltText(current)}` : 'Open image'}
          >
            <img
              src={mediaUrl(current.id)}
              alt={imageAltText(current)}
              draggable={false}
              className="discover-image"
            />
          </button>
        )}
      </div>

      <div className="discover-actions">
        {current && (
          <button
            type="button"
            className="btn-primary discover-open-btn"
            onClick={() => onOpen(current.id)}
          >
            Open
          </button>
        )}
        <button type="button" className="discover-skip-btn" onClick={advance} disabled={committing}>
          Next
        </button>
      </div>
    </main>
  )
}
