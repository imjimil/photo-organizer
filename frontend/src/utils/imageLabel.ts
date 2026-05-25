import type { ImageSummary } from '../api/client'

export function imageAriaLabel(item: ImageSummary): string {
  const preview = item.ocr_preview?.trim()
  if (preview) {
    const clipped = preview.length > 80 ? `${preview.slice(0, 80)}…` : preview
    return `Open image: ${clipped}`
  }
  const name = item.rel_path.split(/[/\\]/).pop()
  if (name) return `Open image: ${name}`
  return `Open image ${item.id.slice(0, 8)}`
}

export function imageAltText(detail: {
  ocr_text?: string
  ocr_preview?: string
  rel_path?: string
}): string {
  const text = detail.ocr_text?.trim() || detail.ocr_preview?.trim()
  if (text) {
    return text.length > 120 ? `${text.slice(0, 120)}…` : text
  }
  const name = detail.rel_path?.split(/[/\\]/).pop()
  return name ? `Inspiration image: ${name}` : 'Inspiration image'
}
