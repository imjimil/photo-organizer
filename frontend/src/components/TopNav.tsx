import type { CollectionSummary } from '../api/client'
import type { ThemeMode } from '../hooks/useTheme'
import { ThemeToggle } from './ThemeToggle'
import { NavPill } from './NavPill'

export type AppView = 'library' | 'search'

interface TopNavProps {
  view: AppView
  onViewChange: (view: AppView) => void
  total: number
  themeMode: ThemeMode
  onThemeCycle: () => void
  sort: 'date' | 'random'
  onSortChange: (sort: 'date' | 'random') => void
  showSort: boolean
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
  collectionName,
}: {
  view: AppView
  total: number
  themeMode: ThemeMode
  onThemeCycle: () => void
  collectionName?: string
}) {
  return (
    <header className="top-rail md:hidden">
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          {collectionName ? (
            <h1 className="type-heading text-text-primary">{collectionName}</h1>
          ) : (
            <h1 className="type-brand text-text-primary">Opal</h1>
          )}
          <p className="type-eyebrow mt-1">{total.toLocaleString()} saved</p>
        </div>
        <ThemeToggle mode={themeMode} onCycle={onThemeCycle} compact />
      </div>
      {view === 'search' && (
        <p className="type-heading px-4 pb-3 text-text-muted">Discover by mood</p>
      )}
    </header>
  )
}

export function CollectionsStrip({
  collections,
  activeId,
  onSelect,
}: {
  collections: CollectionSummary[]
  activeId: string | null
  onSelect: (id: string | null) => void
}) {
  if (collections.length === 0) return null

  return (
    <div
      className="relative z-10 flex gap-2 overflow-x-auto px-4 py-3 md:px-8"
      role="tablist"
      aria-label="Collections"
    >
      <CollectionChip
        active={activeId === null}
        label="All"
        onClick={() => onSelect(null)}
      />
      {collections.map((c) => (
        <CollectionChip
          key={c.id}
          active={activeId === c.id}
          label={c.name}
          onClick={() => onSelect(c.id)}
        />
      ))}
    </div>
  )
}

function CollectionChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`chip ${active ? 'chip-active' : ''}`}
    >
      {label}
    </button>
  )
}
