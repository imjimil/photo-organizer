interface ContextHintProps {
  children: React.ReactNode
  onDismiss: () => void
  label?: string
}

export function ContextHint({ children, onDismiss, label = 'Tip' }: ContextHintProps) {
  return (
    <aside className="context-hint" aria-label={label}>
      <p className="context-hint-body">{children}</p>
      <button type="button" className="context-hint-dismiss" onClick={onDismiss}>
        Got it
      </button>
    </aside>
  )
}
