declare module 'justified-layout' {
  export interface JustifiedLayoutBox {
    top: number
    left: number
    width: number
    height: number
  }

  export interface JustifiedLayoutOptions {
    containerWidth: number
    targetRowHeight?: number
    targetRowHeightTolerance?: number
    boxSpacing?: number
    containerPadding?: number
    widowLayoutStyle?: string
    showWidows?: boolean
    fullWidthBreakoutRowCadence?: number | false
  }

  export interface JustifiedLayoutResult {
    containerHeight: number
    widowCount: number
    boxes: JustifiedLayoutBox[]
  }

  export default function justifiedLayout(
    aspectRatios: number[],
    options: JustifiedLayoutOptions,
  ): JustifiedLayoutResult
}
