import type { ThemeMode } from '../hooks/useTheme'

interface ThemeToggleProps {
  mode: ThemeMode
  onCycle: () => void
  compact?: boolean
}

const labels: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
}

export function ThemeToggle({ mode, onCycle, compact }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onCycle}
      className="btn-ghost inline-flex items-center gap-2 !px-3"
      aria-label={`Theme: ${labels[mode]}`}
    >
      <ThemeIcon mode={mode} />
      {!compact && (
        <span className="type-eyebrow !text-[0.625rem]">{labels[mode]}</span>
      )}
    </button>
  )
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" strokeLinecap="round" />
      </svg>
    )
  }
  if (mode === 'dark') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent" aria-hidden>
        <path d="M21 14.5A8.5 8.5 0 1112.5 3a6.5 6.5 0 009.5 11.5z" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" strokeLinecap="round" />
    </svg>
  )
}
