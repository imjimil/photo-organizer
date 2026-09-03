import type { ThemeMode } from '../hooks/useTheme'
import { ThemeToggle } from './ThemeToggle'
import {
  IconNavCollections,
  IconNavDiscover,
  IconNavLibrary,
  IconNavSearch,
} from './NavIcons'

export type AppView = 'library' | 'collections' | 'discover' | 'search'

interface EdgeRailProps {
  view: AppView
  onViewChange: (view: AppView) => void
  themeMode: ThemeMode
  onThemeCycle: () => void
  onOpenSources?: () => void
}

const ITEMS: {
  id: AppView
  label: string
  Icon: typeof IconNavLibrary
}[] = [
  { id: 'search', label: 'Search', Icon: IconNavSearch },
  { id: 'library', label: 'Library', Icon: IconNavLibrary },
  { id: 'collections', label: 'Collections', Icon: IconNavCollections },
  { id: 'discover', label: 'Discover', Icon: IconNavDiscover },
]

export function EdgeRail({
  view,
  onViewChange,
  themeMode,
  onThemeCycle,
  onOpenSources,
}: EdgeRailProps) {
  return (
    <nav className="edge-rail hidden md:flex" aria-label="Main">
      <div className="edge-rail-brand">
        <span className="edge-rail-wordmark">Opal</span>
      </div>

      <div className="edge-rail-items">
        {ITEMS.map((item) => {
          const active = view === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`edge-rail-item ${active ? 'edge-rail-item-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onViewChange(item.id)}
            >
              <item.Icon className="edge-rail-icon" filled={active} />
              <span className="edge-rail-label">{item.label}</span>
              {item.id === 'search' && (
                <kbd className="search-kbd ml-auto hidden lg:inline">/</kbd>
              )}
            </button>
          )
        })}
        {onOpenSources && (
          <button type="button" className="edge-rail-item" onClick={onOpenSources}>
            <svg className="edge-rail-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7.5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-9Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M8 5.5V4.5c0-.55.45-1 1-1h6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="edge-rail-label">Sources</span>
          </button>
        )}
      </div>

      <div className="edge-rail-footer">
        <ThemeToggle mode={themeMode} onCycle={onThemeCycle} />
      </div>
    </nav>
  )
}
