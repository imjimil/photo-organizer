import type { AppView } from './TopNav'
import {
  IconNavCollections,
  IconNavDiscover,
  IconNavLibrary,
  IconNavSearch,
} from './NavIcons'

interface NavPillProps {
  view: AppView
  onViewChange: (view: AppView) => void
  className?: string
}

const TABS: {
  id: AppView
  label: string
  shortLabel: string
  Icon: typeof IconNavLibrary
}[] = [
  { id: 'library', label: 'Library', shortLabel: 'Library', Icon: IconNavLibrary },
  { id: 'collections', label: 'Collections', shortLabel: 'Albums', Icon: IconNavCollections },
  { id: 'discover', label: 'Discover', shortLabel: 'Discover', Icon: IconNavDiscover },
  { id: 'search', label: 'Search', shortLabel: 'Search', Icon: IconNavSearch },
]

const VIEW_INDEX: Record<AppView, number> = {
  library: 0,
  collections: 1,
  discover: 2,
  search: 3,
}

export function NavPill({ view, onViewChange, className = '' }: NavPillProps) {
  const index = VIEW_INDEX[view]
  const isMobile = className.includes('nav-pill-float')

  return (
    <div
      className={`nav-pill-track nav-pill-track-4 ${isMobile ? 'nav-pill-track-mobile' : ''} ${className}`}
      role="tablist"
      aria-label="Main navigation"
    >
      <span
        className="nav-pill-indicator nav-pill-indicator-4"
        style={{ '--nav-index': index } as React.CSSProperties}
        aria-hidden
      />
      {TABS.map((tab) => {
        const active = view === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onViewChange(tab.id)}
            className={`nav-pill-btn nav-pill-btn-4 ${isMobile ? 'nav-pill-btn-mobile' : ''} ${active ? 'nav-pill-btn-active' : ''}`}
          >
            {isMobile ? (
              <>
                <tab.Icon className="nav-pill-icon" filled={active} />
                <span className="nav-pill-label">{tab.shortLabel}</span>
              </>
            ) : (
              tab.label
            )}
          </button>
        )
      })}
    </div>
  )
}
