import type { ThemeMode } from '../hooks/useTheme'
import { ThemeToggle } from './ThemeToggle'
import { BackButton } from './BackButton'
import type { AppView } from './EdgeRail'

export type { AppView }

const VIEW_TITLES: Record<AppView, string> = {
  home: 'Home',
  library: 'Library',
  collections: 'Collections',
  discover: 'Discover',
  search: 'Search',
}

interface MobileHeaderProps {
  view: AppView
  total: number
  themeMode: ThemeMode
  onThemeCycle: () => void
  drillIn?: { title: string; onBack: () => void }
  selectionMode?: boolean
  onEnterSelection?: () => void
  sort?: 'date' | 'random'
  onSortChange?: (sort: 'date' | 'random') => void
  showSort?: boolean
  sourcesLabel?: string | null
  onOpenSources?: () => void
}

export function MobileHeader({
  view,
  total,
  themeMode,
  onThemeCycle,
  drillIn,
  selectionMode = false,
  onEnterSelection,
  sort,
  onSortChange,
  showSort = false,
  sourcesLabel = null,
  onOpenSources,
}: MobileHeaderProps) {
  const title = drillIn ? drillIn.title : VIEW_TITLES[view]

  const countLabel = drillIn
    ? `${total.toLocaleString()} photos`
    : view !== 'search' && view !== 'discover' && view !== 'home'
      ? `${total.toLocaleString()} saved`
      : view === 'home'
        ? `${total.toLocaleString()} prints`
        : null

  return (
    <header className="top-rail md:hidden">
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2.5">
          {drillIn && <BackButton compact onClick={drillIn.onBack} />}
          <div className="min-w-0">
            <h1 className={`truncate text-text-primary ${drillIn ? 'type-heading' : 'mobile-page-title'}`}>
              {title}
            </h1>
            {countLabel && <p className="type-caption mt-0.5 tabular-nums">{countLabel}</p>}
            {!drillIn && sourcesLabel && onOpenSources && view === 'library' && (
              <button
                type="button"
                className="nav-sources-label mt-0.5 max-w-[12rem] truncate text-left"
                onClick={onOpenSources}
                title="Manage library folders"
              >
                {sourcesLabel}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenSources && !drillIn && view === 'library' && (
            <button type="button" className="library-select-btn" onClick={onOpenSources}>
              Folders
            </button>
          )}
          {showSort && onSortChange && sort && !drillIn && view === 'library' && (
            <div className="mobile-sort-toggle" role="group" aria-label="Sort library">
              <button
                type="button"
                onClick={() => onSortChange('date')}
                aria-pressed={sort === 'date'}
                className={`mobile-sort-btn ${sort === 'date' ? 'mobile-sort-btn-active' : ''}`}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => onSortChange('random')}
                aria-pressed={sort === 'random'}
                className={`mobile-sort-btn ${sort === 'random' ? 'mobile-sort-btn-active' : ''}`}
              >
                Shuffle
              </button>
            </div>
          )}
          {onEnterSelection && !selectionMode && (
            <button type="button" className="library-select-btn" onClick={onEnterSelection}>
              Select
            </button>
          )}
          <ThemeToggle mode={themeMode} onCycle={onThemeCycle} compact />
        </div>
      </div>
    </header>
  )
}
