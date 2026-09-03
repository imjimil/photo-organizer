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
        <p className="type-eyebrow">Library</p>
        <h2 className="type-heading mt-2 text-text-primary">Nothing indexed yet</h2>
        <p className="type-caption mt-3 max-w-md">
          {desktop
            ? 'Add a folder. Opal watches it in place and builds search as it goes.'
            : 'Index your photo folder from the project root, then refresh this page.'}
        </p>
        {desktop && onAddFolder ? (
          <button type="button" className="btn-primary mt-6" onClick={onAddFolder}>
            Add folder
          </button>
        ) : (
          <>
            <pre className="library-empty-code type-meta mt-6">npm run index:full</pre>
            <p className="type-caption mt-3 max-w-sm text-text-faint">
              First run takes a while for large folders.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="library-empty">
      <p className="type-eyebrow">Library</p>
      <h2 className="type-heading mt-2 text-text-primary">No photos to show</h2>
      <p className="type-caption mt-3 max-w-md">
        Indexing may still be running, or filters may be hiding everything.
      </p>
      {onTryDiscover && (
        <button type="button" className="btn-primary mt-6" onClick={onTryDiscover}>
          Open Discover
        </button>
      )}
    </div>
  )
}
