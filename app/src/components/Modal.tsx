import { ReactNode, useEffect, useRef } from 'react'

// Generic full-screen overlay: click the backdrop (or anywhere inside, since
// callers may want "click to dismiss" on their content too) or press Escape
// to close. Callers own what's rendered inside.
//
// Everything below the click/Escape handling exists because this is a
// *dialog*, and a bare div that merely looks like one leaves keyboard and
// screen-reader users stuck: nothing announces that a dialog opened,
// Tab walks off into the page behind it, and closing it drops focus back
// to the top of the document. The image zoom this powers is on the
// public Documents and Galleries pages, so it's the most-reached
// interactive thing on the site.
export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Captured on open so focus can be handed back to whatever the person
  // was on when they closed it -- without this, dismissing a zoomed
  // photo drops focus to the top of the document and they have to tab
  // all the way back to where they were.
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    // The panel itself takes focus (it carries tabIndex={-1} below)
    // rather than the first focusable child: these dialogs are usually a
    // single image with no controls, so there often is no child to focus,
    // and starting at the container also means a screen reader reads the
    // dialog's own label first.
    panelRef.current?.focus()

    // Scroll lock. Without it the page behind keeps scrolling under the
    // overlay, which on a phone reads as the zoom having failed.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      // Focus trap. Tab from the last focusable element wraps to the
      // first rather than escaping to the page underneath -- which is
      // both disorienting and, since the backdrop covers everything,
      // invisible.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) {
        // Nothing to move between (the common case here: a lone image),
        // so keep focus on the panel instead of letting Tab leave.
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* role/aria-modal on the panel, not the backdrop, so assistive
          tech treats the content as the dialog and ignores the rest of
          the page while it's open. tabIndex={-1} makes it focusable
          programmatically without adding it to the tab order. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Enlarged image"
        tabIndex={-1}
        className="outline-none"
      >
        {children}
      </div>
    </div>
  )
}
