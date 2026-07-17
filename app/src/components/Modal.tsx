import { ReactNode, useEffect } from 'react'

// Generic full-screen overlay: click the backdrop (or anywhere inside, since
// callers may want "click to dismiss" on their content too) or press Escape
// to close. Callers own what's rendered inside.
export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {children}
    </div>
  )
}
