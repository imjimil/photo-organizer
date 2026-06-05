type IconProps = { className?: string; filled?: boolean }

export function IconNavHome({ className = 'nav-icon', filled }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.5 10.2V19c0 .55.45 1 1 1h4.25v-5h3.5V20H17.5c.55 0 1-.45 1-1v-8.8L12 5.8l-6.5 4.4Z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinejoin="round"
      />
      <path
        d="M4 11.5 12 5l8 6.5"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconNavLibrary({ className = 'nav-icon', filled }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="3.5"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        fill={filled ? 'currentColor' : 'none'}
      />
      <rect
        x="13.5"
        y="3.5"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        fill={filled ? 'currentColor' : 'none'}
      />
      <rect
        x="3.5"
        y="13.5"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        fill={filled ? 'currentColor' : 'none'}
      />
      <rect
        x="13.5"
        y="13.5"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

export function IconNavCollections({ className = 'nav-icon', filled }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5c0-1.1.9-2 2-2h5l1.5 2H20c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-9Z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinejoin="round"
      />
      <path
        d="M8 6.5V5.5c0-.55.45-1 1-1h2.2"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconNavDiscover({ className = 'nav-icon', filled }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      {filled && <circle cx="12" cy="12" r="8.5" fill="currentColor" opacity="0.16" />}
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M12 6.8 14.6 15.2 12 13.3 9.4 15.2 12 6.8Z"
        fill="currentColor"
        opacity={filled ? 1 : 0.9}
      />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function IconNavSearch({ className = 'nav-icon', filled }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="10.75"
        cy="10.75"
        r="5.75"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        fill={filled ? 'currentColor' : 'none'}
      />
      <path
        d="M15.5 15.5 20 20"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.75}
        strokeLinecap="round"
      />
    </svg>
  )
}
