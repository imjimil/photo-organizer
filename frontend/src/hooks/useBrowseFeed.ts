import { useCallback, useEffect, useState } from 'react'
import { browse, type BrowseOptions, type ImageSummary } from '../api/client'

export function useBrowseFeed(
  sort: 'date' | 'random' = 'date',
  options: BrowseOptions = {},
  enabled = true,
) {
  const folder = options.folder ?? null
  const album = options.album ?? null
  const [items, setItems] = useState<ImageSummary[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [total, setTotal] = useState(0)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(false)
    setItems([])
    setOffset(0)
    setHasMore(true)
    try {
      const browseOptions: BrowseOptions = {}
      if (folder) browseOptions.folder = folder
      if (album) browseOptions.album = album
      const data = await browse(0, 40, sort, browseOptions)
      setItems(data.items)
      setOffset(data.items.length)
      setHasMore(data.has_more)
      setTotal(data.total)
    } catch {
      setError(true)
      setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [sort, folder, album])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      setItems([])
      setOffset(0)
      setHasMore(true)
      try {
        const browseOptions: BrowseOptions = {}
        if (folder) browseOptions.folder = folder
        if (album) browseOptions.album = album
        const data = await browse(0, 40, sort, browseOptions)
        if (cancelled) return
        setItems(data.items)
        setOffset(data.items.length)
        setHasMore(data.has_more)
        setTotal(data.total)
      } catch {
        if (!cancelled) {
          setError(true)
          setItems([])
          setHasMore(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [sort, folder, album, enabled])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const browseOptions: BrowseOptions = {}
      if (folder) browseOptions.folder = folder
      if (album) browseOptions.album = album
      const data = await browse(offset, 40, sort, browseOptions)
      setItems((prev) => [...prev, ...data.items])
      setOffset((prev) => prev + data.items.length)
      setHasMore(data.has_more)
      setTotal(data.total)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [offset, loading, hasMore, sort, folder, album])

  return { items, loading, error, hasMore, loadMore, total, reload }
}
