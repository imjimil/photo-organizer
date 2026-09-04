import { useCallback, useEffect, useState } from 'react'
import { getIndexStatus, type IndexStatus } from '../api/client'

const defaultStatus: IndexStatus = {
  running: false,
  phase: 'idle',
  source_id: null,
  current: 0,
  total: 0,
  percent: 0,
  eta_seconds: null,
  rate_per_second: 0,
  message: '',
  error: null,
  counts: {},
  search_ready_percent: 0,
  browse_ready: 0,
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return 'Calculating…'
  if (seconds < 60) return `${seconds}s left`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m left`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.ceil((seconds % 3600) / 60)
  return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`
}

export function phaseLabel(phase: string): string {
  switch (phase) {
    case 'scanning':
      return 'Scanning'
    case 'thumbnails':
      return 'Thumbnails'
    case 'clip':
      return 'Visual index'
    case 'ocr':
      return 'Text index'
    case 'done':
      return 'Done'
    default:
      return 'Idle'
  }
}

export function useIndexJob(pollMs = 1500) {
  const [status, setStatus] = useState<IndexStatus>(defaultStatus)

  const refresh = useCallback(async () => {
    try {
      const next = await getIndexStatus()
      setStatus(next)
    } catch {
      /* API may be starting */
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, pollMs)
    return () => window.clearInterval(id)
  }, [pollMs, refresh])

  return {
    status,
    refresh,
    indexing: status.running,
    searchPartial: status.running,
  }
}
