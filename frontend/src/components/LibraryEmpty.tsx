interface LibraryEmptyProps {
  indexed: boolean
  onTryDiscover?: () => void
  onAddFolder?: () => void
  desktop?: boolean
}

export function LibraryEmpty({
  indexed,
  onTryDiscover,
  onAddFolder,
  desktop = false,
}: LibraryEmptyProps) {
  if (!indexed) {
    return (
      <div className="library-empty">
        <p className="type-eyebrow text-text-muted">Your library</p>
        <h2 className="type-quote mt-3 text-text-primary">Nothing indexed yet</h2>
        <p className="type-caption mt-4 max-w-md text-center text-text-muted">
          {desktop
            ? 'Add a folder to start indexing your photos.'
            : 'Index your photo folder from the project root, then refresh this page.'}
        </p>
        {desktop && onAddFolder ? (
          <button type="button" className="btn-primary mt-8" onClick={onAddFolder}>
            Add folder
          </button>
        ) : (
          <>
            <pre className="library-empty-code type-meta mt-6">npm run index:full</pre>
            <p className="type-caption mt-4 max-w-sm text-center text-text-faint">
              First run takes a while for large folders.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="library-empty">
      <p className="type-eyebrow text-text-muted">Your library</p>
      <h2 className="type-quote mt-3 text-text-primary">No photos to show</h2>
      <p className="type-caption mt-4 max-w-md text-center">
        Photos may still be indexing, or filters may be hiding everything.
      </p>
      {onTryDiscover && (
        <button type="button" className="btn-primary mt-8" onClick={onTryDiscover}>
          Try Discover
        </button>
      )}
    </div>
  )
}
