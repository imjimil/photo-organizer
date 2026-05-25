import { type RefObject, useLayoutEffect, useRef } from 'react'

export function clearFlipTransforms(container: HTMLElement | null) {
  if (!container) return
  container.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((node) => {
    node.style.transform = ''
    node.style.transition = ''
  })
}

export function useFlipList(
  containerRef: RefObject<HTMLElement | null>,
  orderKey: string,
  enabled = true,
) {
  const positionsRef = useRef<Map<string, DOMRect>>(new Map())
  const readyRef = useRef(false)
  const frameRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    const nodes = container.querySelectorAll<HTMLElement>('[data-flip-id]')
    const nextPositions = new Map<string, DOMRect>()

    nodes.forEach((node) => {
      const id = node.dataset.flipId
      if (!id) return
      nextPositions.set(id, node.getBoundingClientRect())
    })

    if (!enabled) {
      clearFlipTransforms(container)
      positionsRef.current = nextPositions
      return
    }

    if (!readyRef.current) {
      readyRef.current = true
      positionsRef.current = nextPositions
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reducedMotion ? '1ms' : '240ms'

    nodes.forEach((node) => {
      const id = node.dataset.flipId
      if (!id) return
      if (node.classList.contains('collection-grid-item-source')) return

      const first = positionsRef.current.get(id)
      const last = nextPositions.get(id)
      if (!first || !last) return

      const dx = first.left - last.left
      const dy = first.top - last.top
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return

      node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      node.style.transition = 'transform 0s'

      frameRef.current = requestAnimationFrame(() => {
        node.style.transition = `transform ${duration} var(--ease-expo)`
        node.style.transform = ''

        const onDone = () => {
          node.style.transition = ''
          node.removeEventListener('transitionend', onDone)
        }
        node.addEventListener('transitionend', onDone)
      })
    })

    positionsRef.current = nextPositions

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [containerRef, orderKey, enabled])
}
