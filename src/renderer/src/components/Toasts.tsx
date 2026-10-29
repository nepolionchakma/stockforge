import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { cx } from './ui'

export function Toasts(): React.JSX.Element {
  const app = useApp()

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[350px] flex-col gap-2">
      {app.toasts.map((toast) => {
        const Icon =
          toast.tone === 'success'
            ? CheckCircle2
            : toast.tone === 'error'
              ? AlertTriangle
              : Info
        return (
          <div
            key={toast.id}
            role="status"
            className="toast-enter pointer-events-auto flex items-start gap-3 rounded-xl border border-edge-strong bg-[#171a22]/95 px-3.5 py-3 shadow-[0_18px_45px_-18px_rgba(0,0,0,.9)] backdrop-blur-xl"
          >
            <Icon
              className={cx(
                'mt-0.5 h-4 w-4 shrink-0',
                toast.tone === 'success'
                  ? 'text-mint'
                  : toast.tone === 'error'
                    ? 'text-danger'
                    : 'text-info'
              )}
              strokeWidth={2}
            />
            <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-ink/90">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => app.dismissToast(toast.id)}
              className="mt-0.5 text-faint transition-colors hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
