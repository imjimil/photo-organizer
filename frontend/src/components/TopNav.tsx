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
          <span className="type-eyebrow tabular-nums">
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
}: {
  view: AppView
  total: number
  themeMode: ThemeMode
  onThemeCycle: () => void
  drillIn?: { title: string; onBack: () => void }
}) {
  return (
    <header className="top-rail md:hidden">
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2.5">
          {drillIn && <BackButton compact onClick={drillIn.onBack} />}
          <div className="min-w-0">
            {drillIn ? (
              <h1 className="type-heading truncate text-text-primary">{drillIn.title}</h1>
            ) : view === 'discover' ? (
              <h1 className="type-brand text-text-primary">Discover</h1>
            ) : view === 'collections' ? (
              <h1 className="type-brand text-text-primary">Collections</h1>
            ) : (
              <h1 className="type-brand text-text-primary">Opal</h1>
            )}
            <p className="type-eyebrow mt-1">{total.toLocaleString()} saved</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle mode={themeMode} onCycle={onThemeCycle} compact />
        </div>
      </div>
      {view === 'search' && (
        <p className="type-eyebrow px-4 pb-2 text-text-muted md:hidden">Search</p>
      )}
    </header>
  )
}
