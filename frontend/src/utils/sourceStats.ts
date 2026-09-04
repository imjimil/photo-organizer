import type { SourceSummary } from '../api/client'
import { phaseLabel } from '../hooks/useIndexJob'

export function formatSourceStats(source: SourceSummary): string {
  const inLibrary = source.browse_count.toLocaleString()
  const duplicates = source.duplicate_count
  const files = source.count.toLocaleString()

  if (duplicates > 0) {
    return `${inLibrary} in library · ${duplicates.toLocaleString()} duplicates · ${files} files`
  }
  if (source.count > 0) {
    return `${inLibrary} in library`
  }
  return 'Not indexed yet'
}

export function formatSourceSearch(source: SourceSummary): string | null {
  if (source.browse_count <= 0) return null

  const total = source.browse_count
  const visual = source.visual_ready
  const text = source.text_ready

  const clip =
    visual >= total
      ? `CLIP ${visual.toLocaleString()}`
      : `CLIP ${visual.toLocaleString()} / ${total.toLocaleString()}`
  const ocr =
    text >= total
      ? `OCR ${text.toLocaleString()}`
      : `OCR ${text.toLocaleString()} / ${total.toLocaleString()}`

  return `${clip} · ${ocr}`
}

export function formatSourceIndexing(source: SourceSummary): string | null {
  if (!source.indexing_phase) return null
  return phaseLabel(source.indexing_phase)
}
