import { IconChevronLeft } from './ViewerIcons'

interface BackButtonProps {
  onClick: () => void
  label?: string
  compact?: boolean
  className?: string
}

export function BackButton({ onClick, label, compact = false, className = '' }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nav-back-btn ${compact ? 'nav-back-btn-compact' : ''} ${className}`.trim()}
      aria-label={label ? `Back to ${label}` : 'Back'}
    >
      <IconChevronLeft className="nav-back-icon" />
      {label && !compact && <span className="nav-back-label truncate">{label}</span>}
    </button>
  )
}
