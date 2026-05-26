import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { CollectionSummary, SearchPlanSummary } from '../api/client'
import type { LocalSearchHistoryEntry } from '../hooks/useSearchHistory'
import {
  activeFilterLabels,
  chipsAreActive,
  planPills,
  type SearchChipState,
  visibleFolders,
} from '../search/plan'

interface SearchViewProps {
  query: string
  onQueryChange: (q: string) => void
  chips: SearchChipState
  onChipsChange: (chips: SearchChipState) => void
  collections: CollectionSummary[]
  searching: boolean
  pending?: boolean
  plan?: SearchPlanSummary | null
  resultCount?: number
  history: LocalSearchHistoryEntry[]
  onPickHistory: (entry: LocalSearchHistoryEntry) => void
  onClearHistory: () => void
}

const MATCH_OPTIONS = [
  { id: 'broad' as const, label: 'Broad' },
  { id: 'balanced' as const, label: 'Balanced' },
  { id: 'strict' as const, label: 'Close' },
]

const CONTENT_OPTIONS = [
  { id: 'all' as const, label: 'All' },
  { id: 'yes' as const, label: 'Text' },
  { id: 'no' as const, label: 'Visual' },
]

const TIME_OPTIONS = [
  { id: 'any' as const, label: 'Any' },
  { id: 'this_year' as const, label: 'This year' },
  { id: 'last_year' as const, label: 'Last year' },
  { id: 'custom' as const, label: 'Range' },
]

export function SearchView({
  query,
  onQueryChange,
  chips,
  onChipsChange,
  collections,
  searching,
  pending = false,
  plan,
  resultCount,
  history,
  onPickHistory,
  onClearHistory,
}: SearchViewProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const activeFilters = activeFilterLabels(chips)
  const filterCount = activeFilters.length

  const status = searching
    ? 'Searching…'
    : pending && query.trim()
      ? '…'
      : resultCount !== undefined
        ? resultCount === 0
          ? 'No matches'
          : `${resultCount} found`
        : ''

  const pills = plan ? planPills(plan) : []
  const showHistory = focused && !query.trim() && history.length > 0

  return (
    <section className="search-shell">
      <div className="search-shell-inner">
        <div className="search-bar">
          <label className="search-field-wrap">
            <span className="search-field-icon" aria-hidden>
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 120)}
              placeholder='Mood, "exact quote", -exclude…'
              className="search-field"
              aria-label="Search your library"
            />
            {(searching || pending) && (
              <span className="search-field-spinner pulse-soft" aria-hidden />
            )}
          </label>

          <button
            type="button"
            className={`search-filter-btn ${filtersOpen ? 'search-filter-btn-open' : ''} ${filterCount > 0 ? 'search-filter-btn-active' : ''}`}
            aria-expanded={filtersOpen}
            aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : 'Filters'}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <FilterIcon />
            {filterCount > 0 && (
              <span className="search-filter-badge">{filterCount}</span>
            )}
          </button>
        </div>

        <div className="search-meta">
          {status && (
            <p
              className={`search-meta-status ${searching || pending ? 'pulse-soft' : ''}`}
              aria-live="polite"
            >
              {status}
            </p>
          )}
          <button
            type="button"
            className="search-meta-link"
            aria-expanded={tipsOpen}
            onClick={() => setTipsOpen((open) => !open)}
          >
            Tips
          </button>
          {!status && (
            <span className="search-meta-hint hidden md:inline">
              <kbd className="search-kbd">/</kbd> to focus
            </span>
          )}
        </div>

        {tipsOpen && (
          <div className="search-tips panel-slide">
            <p>
              <strong>"phrase"</strong> or <strong>exact:words</strong> for quotes
            </p>
            <p>
              <strong>-word</strong> exclude · <strong>in:folder</strong> scope · <strong>during:2024</strong> dates
            </p>
          </div>
        )}

        {!filtersOpen && activeFilters.length > 0 && (
          <div className="search-active-filters" aria-label="Active filters">
            {activeFilters.map((label) => (
              <span key={label} className="search-active-filter">
                {label}
              </span>
            ))}
            <button
              type="button"
              className="search-active-clear"
              onClick={() => setFiltersOpen(true)}
            >
              Edit
            </button>
          </div>
        )}

        {pills.length > 0 && (
          <div className="search-pills" aria-label="Parsed query">
            {pills.map((pill) => (
              <span key={pill.key} className="search-pill">
                {pill.label}
              </span>
            ))}
          </div>
        )}

        {filtersOpen && (
          <div className="search-filters-panel panel-slide">
            <div className="search-filters-grid">
              <FilterRow label="Match">
                {MATCH_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.id}
                    active={chips.match === option.id}
                    onClick={() => onChipsChange({ ...chips, match: option.id })}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </FilterRow>

              <FilterRow label="Content">
                {CONTENT_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.id}
                    active={chips.content === option.id}
                    onClick={() => onChipsChange({ ...chips, content: option.id })}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </FilterRow>

              <FilterRow label="Time">
                {TIME_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.id}
                    active={chips.time === option.id}
                    onClick={() => onChipsChange({ ...chips, time: option.id })}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </FilterRow>

              {collections.length > 0 && (
                <FilterRow label="Folder" scroll>
                  <FilterChip
                    active={!chips.folder}
                    onClick={() => onChipsChange({ ...chips, folder: '' })}
                  >
                    All
                  </FilterChip>
                  {visibleFolders(collections, 8).map((folder) => (
                    <FilterChip
                      key={folder.id}
                      active={chips.folder === folder.id}
                      onClick={() => onChipsChange({ ...chips, folder: folder.id })}
                    >
                      {folder.name}
                    </FilterChip>
                  ))}
                </FilterRow>
              )}
            </div>

            {chips.time === 'custom' && (
              <div className="search-date-row">
                <label className="search-date-field">
                  <span>From</span>
                  <input
                    type="date"
                    value={chips.dateAfter}
                    onChange={(e) => onChipsChange({ ...chips, dateAfter: e.target.value })}
                  />
                </label>
                <label className="search-date-field">
                  <span>To</span>
                  <input
                    type="date"
                    value={chips.dateBefore}
                    onChange={(e) => onChipsChange({ ...chips, dateBefore: e.target.value })}
                  />
                </label>
              </div>
            )}

            {chipsAreActive(chips) && (
              <button
                type="button"
                className="search-filters-reset"
                onClick={() =>
                  onChipsChange({
                    match: 'balanced',
                    content: 'all',
                    folder: '',
                    time: 'any',
                    dateAfter: '',
                    dateBefore: '',
                  })
                }
              >
                Reset filters
              </button>
            )}
          </div>
        )}

        {showHistory && (
          <div className="search-history panel-slide">
            <div className="search-history-head">
              <p>Recent</p>
              <button type="button" onClick={onClearHistory}>
                Clear
              </button>
            </div>
            <div className="search-history-list">
              {history.map((entry) => (
                <button
                  key={`${entry.query}-${entry.searched_at}`}
                  type="button"
                  className="search-history-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPickHistory(entry)}
                >
                  {entry.query || 'Filtered browse'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function FilterRow({
  label,
  scroll,
  children,
}: {
  label: string
  scroll?: boolean
  children: ReactNode
}) {
  return (
    <div className="search-filter-row">
      <span className="search-filter-label">{label}</span>
      <div className={`search-filter-options ${scroll ? 'search-filter-options-scroll' : ''}`}>
        {children}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`search-chip ${active ? 'search-chip-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  )
}
