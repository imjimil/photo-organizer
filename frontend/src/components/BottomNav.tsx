import type { AppView } from './TopNav'
import { NavPill } from './NavPill'

interface BottomNavProps {
  view: AppView
  onViewChange: (view: AppView) => void
}

export function BottomNav({ view, onViewChange }: BottomNavProps) {
  return (
    <nav
      className="mobile-nav-float md:hidden"
      aria-label="Main"
    >
      <NavPill view={view} onViewChange={onViewChange} className="nav-pill-float" />
    </nav>
  )
}
