import type { SearchFilters } from '../api/client'

interface HeaderProps {
  query: string
  onQueryChange: (q: string) => void
  onSearch: () => void
  mode: 'feed' | 'search'
  onModeChange: (mode: 'feed' | 'search') => void
  total: number
  filters: SearchFilters
  onFiltersChange: (f: SearchFilters) => void
  showFilters: boolean
  onToggleFilters: () => void
}

export function Header({
  query,
  onQueryChange,
  onSearch,
  mode,
  onModeChange,
  total,
  filters,
  onFiltersChange,
  showFilters,
  onToggleFilters,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onModeChange('feed')}
            className="group flex items-baseline gap-2 text-left"
          >
            <span className="text-lg font-semibold tracking-[0.06em] text-text-primary md:text-xl">
              Opal
            </span>
            <span className="hidden font-mono text-[11px] text-text-faint sm:inline">
              {total.toLocaleString()} saved
            </span>
          </button>

          <nav className="flex items-center gap-1 rounded-lg bg-bg-elevated p-1">
            <Tab
              active={mode === 'feed'}
              onClick={() => onModeChange('feed')}
              label="Browse"
            />
            <Tab
              active={mode === 'search'}
              onClick={() => onModeChange('search')}
              label="Search"
            />
          </nav>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="A vibe, a feeling, a line you half remember…"
              className="w-full rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-[15px] text-text-primary placeholder:text-text-faint transition-colors focus:border-accent/50 focus:bg-bg-hover"
              aria-label="Search quotes and vibes"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-faint md:inline">
              /
            </kbd>
          </div>
          <button
            type="button"
            onClick={onSearch}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg-base transition-opacity hover:opacity-90"
          >
            Search
          </button>
          <button
            type="button"
            onClick={onToggleFilters}
            aria-expanded={showFilters}
            className="rounded-lg border border-border px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-bg-elevated px-4 py-3 text-sm">
            <label className="flex items-center gap-2 text-text-muted">
              Text
              <select
                value={filters.hasText}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    hasText: e.target.value as SearchFilters['hasText'],
                  })
                }
                className="rounded border border-border bg-bg-base px-2 py-1 text-text-primary"
              >
                <option value="all">All</option>
                <option value="yes">Has text</option>
                <option value="no">Visual only</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-text-muted">
              Folder
              <input
                type="text"
                value={filters.folder}
                onChange={(e) =>
                  onFiltersChange({ ...filters, folder: e.target.value })
                }
                placeholder="2024/03"
                className="w-28 rounded border border-border bg-bg-base px-2 py-1 text-text-primary"
              />
            </label>
            <label className="flex items-center gap-2 text-text-muted">
              Min match
              <input
                type="range"
                min={0}
                max={100}
                value={filters.minSimilarity * 100}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minSimilarity: Number(e.target.value) / 100,
                  })
                }
                className="w-24 accent-accent"
              />
              <span className="font-mono text-xs text-text-faint">
                {Math.round(filters.minSimilarity * 100)}%
              </span>
            </label>
          </div>
        )}
      </div>
    </header>
  )
}

function Tab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-bg-hover text-text-primary'
          : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}
