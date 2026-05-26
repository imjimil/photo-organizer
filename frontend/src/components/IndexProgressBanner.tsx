import type { IndexStatus } from '../api/client'
import { formatEta, phaseLabel } from '../hooks/useIndexJob'

interface IndexProgressBannerProps {
  status: IndexStatus
  onOpenSettings?: () => void
}

export function IndexProgressBanner({ status, onOpenSettings }: IndexProgressBannerProps) {
  if (!status.running && status.search_ready_percent >= 100) return null

  const label = status.running
    ? `${phaseLabel(status.phase)} · ${status.current.toLocaleString()} / ${status.total.toLocaleString()}`
    : `Search ready for ${status.search_ready_percent}% of library`

  const eta = status.running ? formatEta(status.eta_seconds) : null

  return (
    <div className="index-banner" role="status">
      <div className="index-banner-body">
        <p className="index-banner-title">{label}</p>
        {eta && <p className="index-banner-meta">{eta}</p>}
        {!status.running && status.search_ready_percent < 100 && (
          <p className="index-banner-meta">Mood and text search cover indexed photos only</p>
        )}
        {status.running && status.total > 0 && (
          <div className="index-banner-track" aria-hidden>
            <div
              className="index-banner-fill"
              style={{ width: `${Math.min(status.percent, 100)}%` }}
            />
          </div>
        )}
      </div>
      {onOpenSettings && (
        <button type="button" className="index-banner-link" onClick={onOpenSettings}>
          Sources
        </button>
      )}
    </div>
  )
}

interface IndexProgressPanelProps {
  status: IndexStatus
}

export function IndexProgressPanel({ status }: IndexProgressPanelProps) {
  if (!status.running && status.phase === 'idle') {
    return (
      <p className="type-caption text-text-muted">No indexing in progress</p>
    )
  }

  return (
    <div className="index-panel">
      <div className="index-panel-row">
        <span className="type-eyebrow text-text-faint">{phaseLabel(status.phase)}</span>
        {status.running && (
          <span className="type-caption text-text-muted">{formatEta(status.eta_seconds)}</span>
        )}
      </div>
      {status.total > 0 && (
        <>
          <div className="index-banner-track" aria-hidden>
            <div
              className="index-banner-fill"
              style={{ width: `${Math.min(status.percent, 100)}%` }}
            />
          </div>
          <p className="type-caption mt-2 text-text-muted">
            {status.current.toLocaleString()} / {status.total.toLocaleString()} photos
          </p>
        </>
      )}
      <p className="type-caption mt-2 text-text-faint">
        Search ready: {status.search_ready_percent}%
      </p>
    </div>
  )
}
