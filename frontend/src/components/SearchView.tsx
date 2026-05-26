import { useEffect, useRef } from 'react'
import type { SearchFilters } from '../api/client'

interface SearchViewProps {
  query: string
  onQueryChange: (q: string) => void
  searching: boolean
  pending?: boolean
  filters: SearchFilters
  onFiltersChange: (f: SearchFilters) => void
  showFilters: boolean
  onToggleFilters: () => void
  resultCount?: number
}

export function SearchView({
  query,
  onQueryChange,
  searching,
  pending = false,
  filters,
  onFiltersChange,
  showFilters,
  onToggleFilters,
  resultCount,
}: SearchViewProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const status = searching
    ? 'Searching…'
    : pending && query.trim()
      ? 'Waiting for you to pause…'
      : query.trim() && resultCount !== undefined
        ? resultCount === 0
          ? 'No matches'
          : `${resultCount} result${resultCount === 1 ? '' : 's'}`
        : query.trim()
          ? ''
          : 'Start typing to search'

  return (
    <section className="search-panel relative z-10 mx-auto w-full max-w-3xl px-4 pb-6 pt-2 md:px-8 md:pt-8">
      <p className="type-heading mb-1 hidden text-text-primary md:block">Search</p>
      <p className="type-caption mb-4 hidden text-text-muted md:block">
        Find images by feeling, color, or text inside them
      </p>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Mood, color, or words you remember"
        className="search-input"
        aria-label="Search your library"
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p
          className={`type-eyebrow search-status ${searching || pending ? 'pulse-soft' : ''}`}
          aria-live="polite"
        >
          {status}
        </p>
        <button
          type="button"
          onClick={onToggleFilters}
          className={`btn-ghost search-filter-toggle ${showFilters ? 'search-filter-toggle-active' : ''}`}
          aria-expanded={showFilters}
        >
          Filters
        </button>
        <span className="type-eyebrow ml-auto hidden text-text-faint md:inline">
          Press <kbd className="search-kbd">/</kbd> anywhere
        </span>
      </div>

      {showFilters && (
        <div className="search-filters panel-slide mt-8 border-t border-border pt-6">
          <FilterSelect
            label="Text in image"
            value={filters.hasText}
            onChange={(v) =>
              onFiltersChange({
                ...filters,
                hasText: v as SearchFilters['hasText'],
              })
            }
            options={[
              ['all', 'Any'],
              ['yes', 'With readable text'],
              ['no', 'Images only'],
            ]}
          />
          <label className="filter-field">
            <span className="type-eyebrow filter-field-label">Folder</span>
            <input
              type="text"
              value={filters.folder}
              onChange={(e) =>
                onFiltersChange({ ...filters, folder: e.target.value })
              }
              placeholder="Optional path filter"
              className="filter-input"
            />
          </label>
          <label className="filter-field filter-field-range">
            <span className="type-eyebrow filter-field-label">
              Minimum match
            </span>
            <div className="filter-range-row">
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
                className="filter-range accent-accent"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(filters.minSimilarity * 100)}
              />
              <span className="type-meta filter-range-value">
                {Math.round(filters.minSimilarity * 100)}%
              </span>
            </div>
            <span className="type-caption filter-field-hint">
              Lower values return broader matches
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
    <label className="filter-field">
      <span className="type-eyebrow filter-field-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="filter-select"
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
