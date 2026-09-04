import type { IndexStatus, SourceSummary } from '../api/client'
import { formatEta, phaseLabel } from '../hooks/useIndexJob'

interface IndexProgressBannerProps {
  status: IndexStatus
  sources?: SourceSummary[]
  onOpenSettings?: () => void
}

function activeSourceName(status: IndexStatus, sources?: SourceSummary[]): string | null {
  if (!status.source_id || !sources) return null
  return sources.find((s) => s.id === status.source_id)?.name ?? null
}

export function IndexProgressBanner({ status, sources, onOpenSettings }: IndexProgressBannerProps) {
  if (!status.running) return null

  const sourceName = activeSourceName(status, sources)
  const phase = phaseLabel(status.phase)
  const label = sourceName
    ? `${sourceName} · ${phase}`
    : phase
  const progress =
    status.total > 0
      ? `${status.current.toLocaleString()} / ${status.total.toLocaleString()}`
      : status.message

  return (
    <div className="index-banner" role="status">
      <div className="index-banner-body">
        <p className="index-banner-title">{label}</p>
        <p className="index-banner-meta">{progress}</p>
        {status.total > 0 && (
          <div className="index-banner-track" aria-hidden>
            <div
              className="index-banner-fill"
              style={{ width: `${Math.min(status.percent, 100)}%` }}
            />
          </div>
        )}
        {status.eta_seconds !== null && status.eta_seconds > 0 && (
          <p className="index-banner-meta">{formatEta(status.eta_seconds)}</p>
        )}
      </div>
      {onOpenSettings && (
        <button type="button" className="index-banner-link" onClick={onOpenSettings}>
          Details
        </button>
      )}
    </div>
  )
}

interface IndexProgressPanelProps {
  status: IndexStatus
  sources?: SourceSummary[]
}

export function IndexProgressPanel({ status, sources }: IndexProgressPanelProps) {
  if (status.error) {
    return (
      <div className="index-panel index-panel-error" role="alert">
        <p className="type-body text-text-primary">Indexing failed</p>
        <p className="type-caption mt-1 text-text-muted">{status.error}</p>
        <p className="type-caption mt-2 text-text-faint">
          Try Re-scan on the folder in Sources.
        </p>
      </div>
    )
  }

  if (!status.running) return null

  const sourceName = activeSourceName(status, sources)

  return (
    <div className="index-panel">
      <div className="index-panel-row">
        <span className="type-eyebrow text-text-faint">
          {sourceName ? `${sourceName} · ${phaseLabel(status.phase)}` : phaseLabel(status.phase)}
        </span>
        <span className="type-caption text-text-muted">{formatEta(status.eta_seconds)}</span>
      </div>
      {status.total > 0 ? (
        <>
          <div className="index-banner-track" aria-hidden>
            <div
              className="index-banner-fill"
              style={{ width: `${Math.min(status.percent, 100)}%` }}
            />
          </div>
          <p className="type-caption mt-2 text-text-muted">
            {status.current.toLocaleString()} / {status.total.toLocaleString()}
            {status.phase === 'thumbnails' && ' thumbnails'}
            {status.phase === 'clip' && ' photos (visual search)'}
            {status.phase === 'ocr' && ' photos (text search)'}
          </p>
        </>
      ) : (
        <p className="type-caption mt-2 text-text-muted">{status.message || 'Starting…'}</p>
      )}
      <p className="type-caption mt-2 text-text-faint">
        Thumbnails appear first. Search improves as indexing finishes.
      </p>
    </div>
  )
}
