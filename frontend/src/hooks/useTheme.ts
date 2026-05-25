import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'opal-theme'

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute(
      'content',
      resolved === 'light' ? '#faf9fc' : '#1a1625',
    )
  }
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system'
  })

  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    resolveTheme(mode),
  )

  useEffect(() => {
    const next = resolveTheme(mode)
    setResolved(next)
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = resolveTheme('system')
      setResolved(next)
      applyTheme(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
  }, [])

  const cycle = useCallback(() => {
    document.documentElement.classList.add('theme-transition')
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 420)
    setModeState((prev) => {
      const order: ThemeMode[] = ['light', 'dark', 'system']
      const i = order.indexOf(prev)
      return order[(i + 1) % order.length]
    })
  }, [])

  return { mode, resolved, setMode, cycle }
}

export function initThemeFromStorage() {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  const mode: ThemeMode =
    stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system'
  applyTheme(resolveTheme(mode))
}
