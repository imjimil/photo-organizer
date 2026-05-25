import type { ThemeMode } from '../hooks/useTheme'
import { ThemeToggle } from './ThemeToggle'
import { NavPill } from './NavPill'
import { BackButton } from './BackButton'
export type AppView = 'library' | 'collections' | 'discover' | 'search'

interface TopNavProps {
  view: AppView
  onViewChange: (view: AppView) => void
  total: number
  themeMode: ThemeMode
  onThemeCycle: () => void
  sort: 'date' | 'random'
  onSortChange: (sort: 'date' | 'random') => void
  showSort: boolean
  selectionMode?: boolean
  onEnterSelection?: () => void
}

export function TopNav({
  view,
  onViewChange,
  total,
  themeMode,
  onThemeCycle,
  sort,
  onSortChange,
  showSort,
  selectionMode = false,
  onEnterSelection,
}: TopNavProps) {
  return (
    <header className="top-rail hidden md:block">
      <div className="top-rail-inner mx-auto max-w-[1680px] px-8 py-4">
        <div className="top-rail-brand flex min-w-0 items-center gap-8">
          <h1 className="type-brand text-text-primary">Opal</h1>
          <span className="type-meta">
            {total.toLocaleString()} saved
          </span>
        </div>

        <div className="top-rail-center">
          <NavPill view={view} onViewChange={onViewChange} />
        </div>

        <div className="top-rail-actions">
          {onEnterSelection && !selectionMode && (
            <button type="button" className="library-select-btn" onClick={onEnterSelection}>
              Select
            </button>
          )}
          <div
            className={`flex items-center gap-2 ${showSort ? '' : 'invisible pointer-events-none'}`}
            role="group"
            aria-label="Sort"
            aria-hidden={!showSort}
          >
            <button
              type="button"
              onClick={() => onSortChange('date')}
              aria-pressed={sort === 'date'}
              className={`sort-link ${sort === 'date' ? 'sort-link-active' : ''}`}
              tabIndex={showSort ? 0 : -1}
            >
              Recent
            </button>
            <span className="text-text-faint opacity-40">·</span>
            <button
              type="button"
              onClick={() => onSortChange('random')}
              aria-pressed={sort === 'random'}
              className={`sort-link ${sort === 'random' ? 'sort-link-active' : ''}`}
              tabIndex={showSort ? 0 : -1}
            >
              Shuffle
            </button>
          </div>
          <ThemeToggle mode={themeMode} onCycle={onThemeCycle} compact />
        </div>
      </div>
    </header>
  )
}

export function MobileHeader({
  view,
  total,
  themeMode,
  onThemeCycle,
  drillIn,
  selectionMode = false,
  onEnterSelection,
}: {
  view: AppView
  total: number
  themeMode: ThemeMode
  onThemeCycle: () => void
  drillIn?: { title: string; onBack: () => void }
  selectionMode?: boolean
  onEnterSelection?: () => void
}) {
  const title = drillIn
    ? drillIn.title
    : view === 'discover'
      ? 'Discover'
      : view === 'collections'
        ? 'Collections'
        : view === 'search'
          ? 'Search'
          : 'Opal'

  const countLabel = drillIn
    ? `${total.toLocaleString()} photos`
    : view !== 'search'
      ? `${total.toLocaleString()} saved`
      : null

  return (
    <header className="top-rail md:hidden">
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2.5">
          {drillIn && <BackButton compact onClick={drillIn.onBack} />}
          <div className="min-w-0">
            <h1
              className={`truncate text-text-primary ${drillIn ? 'type-heading' : 'type-brand'}`}
            >
              {title}
            </h1>
            {countLabel && <p className="type-meta mt-1">{countLabel}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
