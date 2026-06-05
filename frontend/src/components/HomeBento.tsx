import { useMemo } from 'react'
import type { CollectionSummary, ImageSummary } from '../api/client'
import { thumbUrl } from '../api/client'
import { IconNavSearch } from './NavIcons'

interface HomeBentoProps {
  total: number
  recent: ImageSummary[]
  collections: CollectionSummary[]
  discoverCover: ImageSummary | null
  onOpenPhoto: (id: string) => void
  onOpenCollection: (collection: CollectionSummary) => void
  onShuffle: () => void
  onDiscover: () => void
  onOpenLibrary: () => void
  onSearch: () => void
}

function photoDate(item: ImageSummary): string | null {
  if (item.exif_date) return item.exif_date.slice(0, 10)
  return null
}

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const today = new Date().toISOString().slice(0, 10)
  return iso === today
}

function withinDays(iso: string | null, days: number): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return d >= cutoff
}

export function HomeBento({
  total,
  recent,
  collections,
  discoverCover,
  onOpenPhoto,
  onOpenCollection,
  onShuffle,
  onDiscover,
  onOpenLibrary,
  onSearch,
}: HomeBentoProps) {
  const todayPhoto = useMemo(() => {
    return recent.find((item) => isToday(photoDate(item))) ?? recent[0] ?? null
  }, [recent])

  const lastWeek = useMemo(() => {
    const week = recent.filter((item) => withinDays(photoDate(item), 7)).slice(0, 6)
    return week.length > 0 ? week : recent.slice(0, 6)
  }, [recent])

  const shuffleCover = useMemo(() => recent[Math.floor(Math.random() * Math.min(recent.length, 8))] ?? null, [recent])

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  return (
    <div className="bento bento-stagger">
      <button
        type="button"
        className="bento-cell bento-hero"
        onClick={() => todayPhoto && onOpenPhoto(todayPhoto.id)}
      >
        {todayPhoto ? (
          <img src={thumbUrl(todayPhoto.id)} alt="" className="bento-hero-img" />
        ) : (
          <div className="bento-hero-empty" />
        )}
        <div className="bento-hero-copy">
          <p className="type-eyebrow bento-hero-eyebrow">{greeting}</p>
          <h2 className="bento-hero-title">{todayLabel}</h2>
          <p className="bento-hero-sub">Lift a print from today&apos;s contact sheet</p>
        </div>
      </button>

      <div className="bento-side">
        <button type="button" className="bento-cell bento-stat" onClick={onOpenLibrary}>
          <span className="bento-stat-num">{total.toLocaleString()}</span>
          <span className="bento-stat-label">saved prints</span>
        </button>

        <button type="button" className="bento-cell bento-shuffle" onClick={onShuffle}>
          {shuffleCover && (
            <img src={thumbUrl(shuffleCover.id)} alt="" className="bento-shuffle-bg" aria-hidden />
          )}
          <span className="bento-shuffle-inner">
            <span className="type-eyebrow">Shuffle</span>
            <span className="bento-shuffle-title">Surprise me</span>
            <span className="bento-shuffle-sub">Open the library shuffled</span>
          </span>
        </button>

        <button type="button" className="bento-cell bento-search" onClick={onSearch}>
          <IconNavSearch className="bento-search-icon" />
          <span className="bento-search-copy">
            <span className="bento-search-title">Search</span>
            <span className="bento-search-sub">Find a phrase or mood</span>
          </span>
          <kbd className="bento-search-kbd">/</kbd>
        </button>
      </div>

      <section className="bento-cell bento-collections" aria-label="Collections">
        <div className="bento-collections-head">
          <div>
            <p className="type-eyebrow">Collections</p>
            <p className="bento-collections-lead">Folders from your library</p>
          </div>
          <button type="button" className="bento-link" onClick={onOpenLibrary}>
            All library
          </button>
        </div>
        <div className="bento-collections-strip">
          {collections.length === 0 ? (
            <p className="bento-collections-empty">No folders yet. Add a source to start.</p>
          ) : (
            collections.slice(0, 14).map((col) => (
              <button
                key={col.id}
                type="button"
                className="bento-collection-pill"
                onClick={() => onOpenCollection(col)}
              >
                <span className="bento-collection-name">{col.name}</span>
                <span className="bento-collection-count">{col.count.toLocaleString()}</span>
              </button>
            ))
          )}
        </div>
      </section>

      <div className="bento-cell bento-recent">
        <div className="bento-recent-head">
          <p className="type-eyebrow">Last week</p>
          <button type="button" className="bento-link" onClick={onOpenLibrary}>
            See all
          </button>
        </div>
        <div className="bento-mosaic">
          {lastWeek.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`bento-mosaic-tile bento-mosaic-tile-${(i % 6) + 1}`}
              onClick={() => onOpenPhoto(item.id)}
            >
              <img src={thumbUrl(item.id)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="bento-cell bento-discover" onClick={onDiscover}>
        {discoverCover && (
          <img src={thumbUrl(discoverCover.id)} alt="" className="bento-discover-img" />
        )}
        <div className="bento-discover-scrim" />
        <div className="bento-discover-copy">
          <p className="type-eyebrow">Discover</p>
          <p className="bento-discover-title">One you forgot</p>
          <p className="bento-discover-sub">Swipe through saved prints</p>
        </div>
      </button>
    </div>
  )
}
