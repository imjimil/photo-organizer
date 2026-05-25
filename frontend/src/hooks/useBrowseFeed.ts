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
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    async function load() {
      setLoading(true)
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
    } finally {
      setLoading(false)
    }
  }, [offset, loading, hasMore, sort, folder, album])

  return { items, loading, hasMore, loadMore, total }
}
