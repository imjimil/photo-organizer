import { useState } from 'react'
import type { SourceSummary } from '../api/client'
import type { IndexStatus } from '../api/client'
import { IndexProgressPanel } from './IndexProgressBanner'
import { revealPath } from '../utils/desktop'

interface SourcesSettingsProps {
  sources: SourceSummary[]
  indexStatus: IndexStatus
  onAddFolder: () => Promise<void>
  onRemove: (id: string) => Promise<void>
  onRescan: (id: string) => Promise<void>
  onClose: () => void
}

export function SourcesSettings({
  sources,
  indexStatus,
  onAddFolder,
  onRemove,
  onRescan,
  onClose,
}: SourcesSettingsProps) {
  const [busy, setBusy] = useState<string | null>(null)

  const handleRemove = async (source: SourceSummary) => {
    if (
      !window.confirm(
        `Remove "${source.name}" from Opal? Files stay on disk. Index data is kept for quick re-add.`,
      )
    ) {
      return
    }
    setBusy(source.id)
    try {
      await onRemove(source.id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="settings-sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="settings-sheet panel-slide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="settings-title"
      >
        <div className="settings-sheet-head">
          <h2 id="settings-title" className="type-heading">
            Sources
          </h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>

        <IndexProgressPanel status={indexStatus} />

        <div className="settings-sources-list mt-6">
          {sources.length === 0 && (
            <p className="type-caption text-text-muted">No folders added yet</p>
          )}
          {sources.map((source) => (
            <div key={source.id} className="settings-source-row">
              <div className="min-w-0 flex-1">
                <p className="type-body truncate text-text-primary">{source.name}</p>
                <p className="type-caption truncate text-text-faint">{source.path}</p>
                <p className="type-caption mt-1 text-text-muted">
                  {source.browse_count.toLocaleString()} browsable ·{' '}
                  {source.count.toLocaleString()} indexed
                </p>
              </div>
              <div className="settings-source-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy === source.id || indexStatus.running}
                  onClick={() => onRescan(source.id)}
                >
                  Re-scan
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => revealPath(source.path)}
                >
                  Reveal
                </button>
                <button
                  type="button"
                  className="btn-ghost text-text-muted"
                  disabled={busy === source.id}
                  onClick={() => handleRemove(source)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary mt-6 w-full"
          disabled={indexStatus.running}
          onClick={async () => {
            setBusy('add')
            try {
              await onAddFolder()
            } finally {
              setBusy(null)
            }
          }}
        >
          Add folder
        </button>
      </div>
    </div>
  )
}
