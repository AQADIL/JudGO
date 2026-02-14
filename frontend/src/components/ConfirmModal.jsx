import { useEffect } from 'react'

export function ConfirmModal({ open, title, message, confirmText = 'Yes', cancelText = 'Cancel', danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md glass rounded-xl2 border border-white/10 p-5">
        <div className="space-y-2">
          <div className="text-frost-50 text-lg">{title}</div>
          {message ? <div className="text-frost-200 text-sm">{message}</div> : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="glass px-4 py-3 rounded-lg text-frost-50"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={
              danger
                ? 'glass px-4 py-3 rounded-lg text-red-200 border border-red-500/30'
                : 'glass px-4 py-3 rounded-lg text-frost-50'
            }
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
