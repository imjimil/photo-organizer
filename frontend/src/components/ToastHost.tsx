import type { ToastTone } from '../hooks/useToast'

interface ToastHostProps {
  toasts: { id: number; message: string; tone: ToastTone }[]
}

export function ToastHost({ toasts }: ToastHostProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-host" aria-live="polite" aria-atomic="true">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`toast-item toast-item-${item.tone}`}
          role={item.tone === 'error' ? 'alert' : 'status'}
        >
          {item.message}
        </div>
      ))}
    </div>
  )
}
