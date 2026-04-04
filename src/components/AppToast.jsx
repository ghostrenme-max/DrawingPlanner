import { useEffect } from 'react'
import './AppToast.css'

/**
 * @param {{ message: string; open: boolean; onClose: () => void; durationMs?: number }} props
 */
export default function AppToast({ message, open, onClose, durationMs = 3200 }) {
  useEffect(() => {
    if (!open) return undefined
    const t = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(t)
  }, [open, onClose, durationMs])

  if (!open || !message) return null

  return (
    <div className="app-toast" role="status" aria-live="polite">
      <div className="app-toast-inner">{message}</div>
    </div>
  )
}
