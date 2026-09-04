import { useCallback, useEffect, useState } from 'react'
import {
  addSource,
  getSources,
  removeSource,
  scanSource,
  type SourceSummary,
} from '../api/client'
import { pickPhotoFolder } from '../utils/desktop'

export function useSources() {
  const [sources, setSources] = useState<SourceSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getSources(true)
      setSources(data.sources.filter((s) => !s.removed))
    } catch {
      setSources([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Defer so setState from refresh isn't synchronous inside the effect body.
    const kickoff = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(kickoff)
  }, [refresh])

  const pickAndAdd = useCallback(async () => {
    const path = await pickPhotoFolder()
    if (!path) return null
    const source = await addSource(path)
    await refresh()
    return source
  }, [refresh])

  const remove = useCallback(
    async (sourceId: string) => {
      await removeSource(sourceId)
      await refresh()
    },
    [refresh],
  )

  const rescan = useCallback(async (sourceId: string) => {
    await scanSource(sourceId)
  }, [])

  const activeSources = sources.filter((s) => s.active)

  return {
    sources,
    activeSources,
    loading,
    refresh,
    pickAndAdd,
    remove,
    rescan,
    hasSources: activeSources.length > 0,
  }
}
