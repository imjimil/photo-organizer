import type { AppView } from './TopNav'
import { NavPill } from './NavPill'

interface BottomNavProps {
  view: AppView
  onViewChange: (view: AppView) => void
  hidden?: boolean
}

export function BottomNav({ view, onViewChange, hidden = false }: BottomNavProps) {
  return (
    <nav
      className={`mobile-nav-float md:hidden ${hidden ? 'mobile-nav-hidden' : ''}`}
      aria-label="Main"
      aria-hidden={hidden}
    >
      <NavPill view={view} onViewChange={onViewChange} className="nav-pill-float" />
    </nav>
  )
}
