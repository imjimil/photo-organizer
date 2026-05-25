import type { AppView } from './TopNav'

interface NavPillProps {
  view: AppView
  onViewChange: (view: AppView) => void
  className?: string
}

export function NavPill({ view, onViewChange, className = '' }: NavPillProps) {
  return (
    <div
      className={`nav-pill-track ${className}`}
      role="tablist"
      aria-label="Main navigation"
    >
      <span
        className={`nav-pill-indicator ${view === 'search' ? 'nav-pill-indicator-search' : ''}`}
        aria-hidden
      />
      <button
        type="button"
        role="tab"
        aria-selected={view === 'library'}
        onClick={() => onViewChange('library')}
        className={`nav-pill-btn ${view === 'library' ? 'nav-pill-btn-active' : ''}`}
      >
        Library
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'search'}
        onClick={() => onViewChange('search')}
        className={`nav-pill-btn ${view === 'search' ? 'nav-pill-btn-active' : ''}`}
      >
        Search
      </button>
    </div>
  )
}
