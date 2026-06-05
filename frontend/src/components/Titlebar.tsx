import { useCallback, useEffect, useState } from 'react'
import { isDesktopShell } from '../api/client'

export function Titlebar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isDesktopShell()) return
    let cancelled = false

    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        if (cancelled) return
        setMaximized(await win.isMaximized())
        const unlisten = await win.onResized(async () => {
          if (!cancelled) setMaximized(await win.isMaximized())
        })
        return () => {
          unlisten()
        }
      } catch {
        /* web preview */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const withWindow = useCallback(async (fn: (win: import('@tauri-apps/api/window').Window) => Promise<void>) => {
    if (!isDesktopShell()) return
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await fn(getCurrentWindow())
    } catch {
      /* noop */
    }
  }, [])

  if (!isDesktopShell()) return null

  return (
    <header className="titlebar hidden md:flex" data-tauri-drag-region>
      <div
        className="titlebar-drag"
        data-tauri-drag-region
        onDoubleClick={() => void withWindow((w) => w.toggleMaximize())}
      />

      <div className="titlebar-controls" data-tauri-drag-region={false}>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Minimize"
          onClick={() => void withWindow((w) => w.minimize())}
        >
          <span aria-hidden>─</span>
        </button>
        <button
          type="button"
          id="titlebar-maximize"
          className="titlebar-btn"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => void withWindow((w) => w.toggleMaximize())}
        >
          <span className="titlebar-maximize-glyph" aria-hidden>
            {maximized ? '❐' : '□'}
          </span>
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn-close"
          aria-label="Close"
          onClick={() => void withWindow((w) => w.close())}
        >
          <span aria-hidden>✕</span>
        </button>
      </div>
    </header>
  )
}
