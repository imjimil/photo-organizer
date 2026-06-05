import { useEffect, useState } from 'react'
import justifiedLayout from 'justified-layout'

export interface MosaicBox {
  top: number
  left: number
  width: number
  height: number
}

export interface MosaicLayout {
  boxes: MosaicBox[]
  containerHeight: number
}

function targetRowHeight(containerWidth: number): number {
  if (containerWidth >= 1024) return 240
  if (containerWidth >= 640) return 200
  return 160
}

export function useJustifiedLayout(
  items: { w: number | null; h: number | null }[],
  containerRef: React.RefObject<HTMLElement | null>,
): MosaicLayout | null {
  const [layout, setLayout] = useState<MosaicLayout | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const compute = () => {
      const width = el.clientWidth
      if (width <= 0 || items.length === 0) {
        setLayout(null)
        return
      }

      const aspectRatios = items.map((item) => {
        const w = item.w && item.w > 0 ? item.w : 1
        const h = item.h && item.h > 0 ? item.h : 1
        return w / h
      })

      const result = justifiedLayout(aspectRatios, {
        containerWidth: width,
        targetRowHeight: targetRowHeight(width),
        boxSpacing: 8,
        containerPadding: 0,
      })

      setLayout({
        boxes: result.boxes,
        containerHeight: result.containerHeight,
      })
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items, containerRef])

  return layout
}
