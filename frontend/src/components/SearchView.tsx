import { useEffect, useRef } from 'react'
import type { SearchFilters } from '../api/client'

interface SearchViewProps {
  query: string
  onQueryChange: (q: string) => void
  onSearch: () => void
  searching: boolean
  filters: SearchFilters
  onFiltersChange: (f: SearchFilters) => void
  showFilters: boolean
  onToggleFilters: () => void
}

export function SearchView({
  query,
  onQueryChange,
  onSearch,
  searching,
  filters,
  onFiltersChange,
  showFilters,
  onToggleFilters,
}: SearchViewProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <section className="search-panel relative z-10 mx-auto w-full max-w-3xl px-4 pb-6 pt-2 md:px-8 md:pt-8">
      <p className="type-heading mb-1 hidden text-text-primary md:block">
        Search
      </p>
      <p className="type-eyebrow mb-4 hidden text-text-muted md:block">
        Mood, color, or words inside your images
      </p>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        placeholder="Search"
        className="search-input"
        aria-label="Search your library"
      />
      <p className="search-hint type-eyebrow mt-2 text-text-muted md:hidden">
        Mood · color · text in images
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSearch}
          disabled={searching || !query.trim()}
          className="btn-primary"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
        <button type="button" onClick={onToggleFilters} className="btn-ghost">
          Filters
        </button>
        <kbd className="type-eyebrow ml-auto hidden md:inline">Press /</kbd>
      </div>

      {showFilters && (
        <div className="panel-slide mt-8 flex flex-wrap gap-6 border-t border-border pt-6 text-sm">
          <FilterSelect
            label="Text"
            value={filters.hasText}
            onChange={(v) =>
              onFiltersChange({
                ...filters,
                hasText: v as SearchFilters['hasText'],
              })
            }
            options={[
              ['all', 'All'],
              ['yes', 'Has text'],
              ['no', 'Visual only'],
            ]}
          />
          <label className="flex items-center gap-2 text-text-muted">
            <span className="type-eyebrow">Folder</span>
            <input
              type="text"
              value={filters.folder}
              onChange={(e) =>
                onFiltersChange({ ...filters, folder: e.target.value })
              }
              className="rounded-lg border border-border bg-bg-elevated px-2 py-1 text-text-primary"
            />
          </label>
          <label className="flex items-center gap-2 text-text-muted">
            <span className="type-eyebrow">Match</span>
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
              className="accent-accent w-24"
            />
            <span className="font-mono text-xs">
              {Math.round(filters.minSimilarity * 100)}%
            </span>
          </label>
        </div>
      )}
    </section>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label className="flex items-center gap-2 text-text-muted">
      <span className="type-eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-bg-elevated px-2 py-1 text-text-primary"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}
