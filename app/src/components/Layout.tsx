import { ReactNode, useEffect, useRef, useState } from 'react'
import Sidebar from './Sidebar'
import { HeaderRefContext } from '../hooks/useHeaderRef'

export default function Layout({ children }: { children: ReactNode }) {
  // headerRef: pages attach this to their header image wrapper (via
  // useHeaderRef()), if they have one.
  // contentTopRef: marks the shared top edge that both the sidebar and
  // the header image start from -- everything is measured relative to
  // this, not to hardcoded padding/margin assumptions.
  const headerRef = useRef<HTMLDivElement | null>(null)
  const contentTopRef = useRef<HTMLDivElement | null>(null)
  const [dividerOffset, setDividerOffset] = useState<number | null>(null)

  useEffect(() => {
    function measure() {
      if (!headerRef.current || !contentTopRef.current) {
        setDividerOffset(null)
        return
      }
      const headerBottom = headerRef.current.getBoundingClientRect().bottom
      const contentTop = contentTopRef.current.getBoundingClientRect().top
      setDividerOffset(headerBottom - contentTop)
    }

    measure()

    // Re-measure on window resize (catches breakpoint changes, e.g. the
    // header image's own responsive height at the sm: breakpoint).
    window.addEventListener('resize', measure)

    // Re-measure if the header image element itself changes size for
    // any other reason (e.g. a real photo loading in, in Phase 3C).
    let observer: ResizeObserver | null = null
    if (headerRef.current) {
      observer = new ResizeObserver(measure)
      observer.observe(headerRef.current)
    }

    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
    // Re-run when children change, since navigating to a different page
    // may mean headerRef.current now points at a different element (or
    // none at all, if the new page has no header image).
  }, [children])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top accent bar -- 24px tall per original site spec, spans the
          full page width on every page */}
      <div className="h-6 bg-fe-accent w-full" />

      <div ref={contentTopRef} className="flex-1 md:flex">
        <Sidebar dividerOffset={dividerOffset} />
        <main className="flex-1 min-w-0">
          <HeaderRefContext.Provider value={headerRef}>
            {children}
          </HeaderRefContext.Provider>
        </main>
      </div>
    </div>
  )
}