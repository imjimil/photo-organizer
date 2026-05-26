import { useCallback, useState } from 'react'

export function useDismissibleHint(storageKey: string) {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== 'dismissed'
    } catch {
      return true
    }
  })

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(storageKey, 'dismissed')
    } catch {
      /* ignore */
    }
  }, [storageKey])

  return { visible, dismiss }
}
