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

  return (
    <div className="onboarding-shell">
      <div className="onboarding-stage" aria-hidden>
        <div className="onboarding-stage-mark" />
      </div>
      {started ? (
        <div className="onboarding-card">
          <p className="type-eyebrow">Indexing</p>
          <h1 className="type-display mt-2 text-text-primary">Building your library</h1>
          <p className="type-caption mt-3 max-w-sm">
            Thumbnails appear first. Search gets better as visual and text indexing finish.
          </p>
          <div className="mt-8">
            <IndexProgressPanel status={indexStatus} />
          </div>
          {indexStatus.browse_ready > 0 && (
            <button type="button" className="btn-primary mt-8 self-start" onClick={onDone}>
              Open library
            </button>
          )}
        </div>
      ) : (
        <div className="onboarding-card">
          <p className="type-eyebrow">Opal</p>
          <h1 className="type-display mt-2 text-text-primary">Point at a folder</h1>
          <p className="type-caption mt-3 max-w-sm">
            Files stay where they are. Opal indexes them in place so you can search by mood,
            quote, or look.
          </p>
          <button
            type="button"
            className="btn-primary mt-8 self-start"
            disabled={adding}
            onClick={handlePick}
          >
            {adding ? 'Opening picker…' : 'Choose folder'}
          </button>
          <button type="button" className="btn-ghost mt-2 self-start" onClick={onSkip}>
            Skip for now
          </button>
        </div>
      )}
    </div>
  )
}
