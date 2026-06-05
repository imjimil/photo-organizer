import type { AppView } from './EdgeRail'
import {
  IconNavCollections,
  IconNavDiscover,
  IconNavHome,
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
  { id: 'home', label: 'Home', shortLabel: 'Home', Icon: IconNavHome },
  { id: 'library', label: 'Library', shortLabel: 'Library', Icon: IconNavLibrary },
  { id: 'collections', label: 'Collections', shortLabel: 'Albums', Icon: IconNavCollections },
  { id: 'discover', label: 'Discover', shortLabel: 'Discover', Icon: IconNavDiscover },
  { id: 'search', label: 'Search', shortLabel: 'Search', Icon: IconNavSearch },
]

const VIEW_INDEX: Partial<Record<AppView, number>> = {
  home: 0,
  library: 1,
  collections: 2,
  discover: 3,
  search: 4,
}

export function NavPill({ view, onViewChange, className = '' }: NavPillProps) {
  const index = VIEW_INDEX[view] ?? -1
  const isMobile = className.includes('nav-pill-float')

  return (
    <div
      className={`nav-pill-track nav-pill-track-5 ${isMobile ? 'nav-pill-track-mobile' : ''} ${className}`}
      role="navigation"
      aria-label="Main navigation"
    >
      {index >= 0 && (
        <span
          className="nav-pill-indicator nav-pill-indicator-5"
          style={{ '--nav-index': index } as React.CSSProperties}
          aria-hidden
        />
      )}
      {TABS.map((tab) => {
        const active = view === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onViewChange(tab.id)}
            className={`nav-pill-btn nav-pill-btn-5 ${isMobile ? 'nav-pill-btn-mobile' : ''} ${active ? 'nav-pill-btn-active' : ''}`}
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
