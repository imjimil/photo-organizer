import { useState } from 'react'
import type { IndexStatus } from '../api/client'
import { IndexProgressPanel } from './IndexProgressBanner'

interface OnboardingViewProps {
  indexStatus: IndexStatus
  onAddFolder: () => Promise<boolean>
  onSkip: () => void
  onDone: () => void
}

export function OnboardingView({
  indexStatus,
  onAddFolder,
  onSkip,
  onDone,
}: OnboardingViewProps) {
  const [adding, setAdding] = useState(false)
  const started = indexStatus.running || indexStatus.browse_ready > 0

  const handlePick = async () => {
    setAdding(true)
    try {
      const ok = await onAddFolder()
      if (ok) onDone()
    } finally {
      setAdding(false)
    }
  }

  if (started) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-card">
          <p className="type-eyebrow text-text-muted">Setting up</p>
          <h1 className="type-quote mt-2 text-text-primary">Indexing your folder</h1>
          <p className="type-caption mt-3 text-text-muted">
            You can browse photos once thumbnails are ready. Search improves as visual and text
            indexing finish.
          </p>
          <div className="mt-6">
            <IndexProgressPanel status={indexStatus} />
          </div>
          {indexStatus.browse_ready > 0 && (
            <button type="button" className="btn-primary mt-8 w-full" onClick={onDone}>
              Open library
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        <p className="type-eyebrow text-text-muted">Welcome to Opal</p>
        <h1 className="type-quote mt-2 text-text-primary">Where are your images?</h1>
        <p className="type-caption mt-3 max-w-md text-text-muted">
          Add a folder to watch in place. Opal indexes photos for browsing and search without moving
          your files.
        </p>
        <button
          type="button"
          className="btn-primary mt-8 w-full"
          disabled={adding}
          onClick={handlePick}
        >
          {adding ? 'Opening picker…' : 'Choose folder'}
        </button>
        <button type="button" className="btn-ghost mt-3 w-full" onClick={onSkip}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
