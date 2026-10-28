import { useEffect } from 'react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// In-app replacement for window.confirm, styled like the rest of the dashboard.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {danger && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-950 text-red-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </div>
          )}
          <div className="space-y-1">
            <h2 id="confirm-title" className="font-semibold">
              {title}
            </h2>
            <p className="text-sm text-slate-400">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded px-3 py-2 text-sm text-slate-400 hover:text-slate-200">
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className={`rounded px-3 py-2 text-sm font-medium ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
