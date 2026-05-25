import { BackButton } from './BackButton'

interface CollectionDetailHeaderProps {
  name: string
  count: number
  onBack: () => void
}

export function CollectionDetailHeader({ name, count, onBack }: CollectionDetailHeaderProps) {
  return (
    <div className="collection-detail-header">
      <BackButton onClick={onBack} label={name} />
      <span className="collection-detail-count type-meta">
        {count.toLocaleString()} photos
      </span>
    </div>
  )
}
