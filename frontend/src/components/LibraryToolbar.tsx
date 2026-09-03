interface LibraryToolbarProps {
  sort: 'date' | 'random'
  onSortChange: (sort: 'date' | 'random') => void
  selectionMode?: boolean
  onEnterSelection?: () => void
  sourcesLabel?: string | null
  onOpenSources?: () => void
  total: number
}

export function LibraryToolbar({
  sort,
  onSortChange,
  selectionMode = false,
  onEnterSelection,
  sourcesLabel,
  onOpenSources,
  total,
}: LibraryToolbarProps) {
  return (
    <div className="library-toolbar hidden md:flex">
      <div className="library-toolbar-intro">
        <h1 className="page-intro-title text-text-primary">Library</h1>
        <span className="type-caption tabular-nums">{total.toLocaleString()} photos</span>
      </div>
      {sourcesLabel && onOpenSources && (
        <button type="button" className="library-toolbar-link" onClick={onOpenSources}>
          {sourcesLabel}
        </button>
      )}
      <div className="library-toolbar-spacer" />
      {onEnterSelection && !selectionMode && (
        <button type="button" className="library-select-btn" onClick={onEnterSelection}>
          Select
        </button>
      )}
      <div className="library-toolbar-sort" role="group" aria-label="Sort">
        <button
          type="button"
          onClick={() => onSortChange('date')}
          aria-pressed={sort === 'date'}
          className={`sort-link ${sort === 'date' ? 'sort-link-active' : ''}`}
        >
          Recent
        </button>
        <span className="text-text-faint opacity-40">·</span>
        <button
          type="button"
          onClick={() => onSortChange('random')}
          aria-pressed={sort === 'random'}
          className={`sort-link ${sort === 'random' ? 'sort-link-active' : ''}`}
        >
          Shuffle
        </button>
      </div>
    </div>
  )
}
