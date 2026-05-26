import { useCallback, useEffect, useState } from 'react'
import {
  clearSearchHistory as clearRemoteHistory,
  getSearchHistory,
  type SearchHistoryEntry,
  type SearchPlanSummary,
} from '../api/client'

const STORAGE_KEY = 'opal-search-history'
const MAX_ITEMS = 12

export interface LocalSearchHistoryEntry {
  query: string
  plan: SearchPlanSummary
  searched_at: string
}

function readLocal(): LocalSearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LocalSearchHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(items: LocalSearchHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* ignore */
  }
}

function mergeHistory(
  local: LocalSearchHistoryEntry[],
  remote: SearchHistoryEntry[],
): LocalSearchHistoryEntry[] {
  const byQuery = new Map<string, LocalSearchHistoryEntry>()
  for (const item of [...remote, ...local]) {
    const existing = byQuery.get(item.query)
    if (!existing || item.searched_at > existing.searched_at) {
      byQuery.set(item.query, item)
    }
  }
  return [...byQuery.values()]
    .sort((a, b) => b.searched_at.localeCompare(a.searched_at))
    .slice(0, MAX_ITEMS)
}

export function useSearchHistory() {
  const [items, setItems] = useState<LocalSearchHistoryEntry[]>(() => readLocal())

  useEffect(() => {
    getSearchHistory()
      .then((response) => setItems((prev) => mergeHistory(prev, response.items)))
      .catch(() => {})
  }, [])

  const record = useCallback((query: string, plan: SearchPlanSummary) => {
    const entry: LocalSearchHistoryEntry = {
      query,
      plan,
      searched_at: new Date().toISOString(),
    }
    setItems((prev) => {
      const next = mergeHistory(
        [entry, ...prev.filter((item) => item.query !== query)],
        [],
      )
      writeLocal(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setItems([])
    writeLocal([])
    clearRemoteHistory().catch(() => {})
  }, [])

  return { items, record, clear }
}
