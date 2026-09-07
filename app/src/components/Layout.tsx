import { ReactNode, useEffect, useRef, useState } from 'react'
import Sidebar from './Sidebar'
import { FamilyGalleriesContext } from '../hooks/useFamilyGalleries'
import { HeaderRefContext } from '../hooks/useHeaderRef'
import { NarrowTopBarContext } from '../hooks/useNarrowTopBar'
import { GallerySummary } from '../types/family'

interface TopBarStyle {
  marginLeft: number
  width: number
}

export default function Layout({ children }: { children: ReactNode }) {
  // headerRef: pages attach this to their header image wrapper (via
  // useHeaderRef()), if they have one.
  // contentTopRef: marks the shared top edge that both the sidebar and
  // the header image start from -- everything is measured relative to
  // this, not to hardcoded padding/margin assumptions.
  // logoRef: the sidebar's own logo block -- only used for the top bar's
  // left edge (see topBarStyle below), always mounted regardless of page.
  const headerRef = useRef<HTMLDivElement | null>(null)
  const contentTopRef = useRef<HTMLDivElement | null>(null)
  const logoRef = useRef<HTMLDivElement | null>(null)
  const [dividerOffset, setDividerOffset] = useState<number | null>(null)
  // Pushed out by FamilyPage via useSetFamilyGalleries() once its data
  // loads (and cleared on unmount/id change) -- null on every other page.
  const [familyGalleries, setFamilyGalleries] = useState<GallerySummary[] | null>(null)
  // Pushed out by FamilyPage via useSetNarrowTopBar() -- see topBarStyle.
  const [narrowTopBar, setNarrowTopBar] = useState(false)
  const [topBarStyle, setTopBarStyle] = useState<TopBarStyle | null>(null)

  useEffect(() => {
    function measure() {
      if (!headerRef.current || !contentTopRef.current) {
        setDividerOffset(null)
      } else {
        const headerBottom = headerRef.current.getBoundingClientRect().bottom
        const contentTop = contentTopRef.current.getBoundingClientRect().top
        setDividerOffset(headerBottom - contentTop)
      }

      // Family pages only (narrowTopBar) -- the bar runs from the
      // sidebar logo's real left edge to the header image's real right
      // edge. Both shift with the viewport (the sidebar leaves normal
      // flow below the md: breakpoint; the header image is capped at
      // max-w-4xl but shrinks below that on plenty of ordinary laptop
      // screens), so this is measured live rather than assumed from the
      // layout's own fixed CSS widths -- the same reasoning dividerOffset
      // above already relies on. getBoundingClientRect() returns
      // viewport-relative coordinates, and the bar itself is a plain
      // block starting at the true viewport left edge, so those
      // coordinates can be used directly as marginLeft/width with no
      // further conversion.
      if (!narrowTopBar || !logoRef.current || !headerRef.current) {
        setTopBarStyle(null)
      } else {
        const logoRect = logoRef.current.getBoundingClientRect()
        const headerRect = headerRef.current.getBoundingClientRect()
        setTopBarStyle({
          marginLeft: logoRect.left,
          width: headerRect.right - logoRect.left,
        })
      }
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
    // none at all, if the new page has no header image), and narrowTopBar
    // itself changes when FamilyPage mounts/unmounts.
  }, [children, narrowTopBar])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top accent bar -- 24px tall per original site spec. Full page
          width by default; width-matched to the sidebar logo/header image
          (topBarStyle) on Family pages specifically -- see the measure()
          effect above. */}
      <div
        className="h-6 bg-fe-accent"
        style={
          topBarStyle
            ? { marginLeft: topBarStyle.marginLeft, width: topBarStyle.width }
            : { width: '100%' }
        }
      />

      <div ref={contentTopRef} className="flex-1 md:flex">
        <Sidebar
          dividerOffset={dividerOffset}
          familyGalleries={familyGalleries}
          logoRef={logoRef}
        />
        <main className="flex-1 min-w-0">
          <HeaderRefContext.Provider value={headerRef}>
            <FamilyGalleriesContext.Provider value={setFamilyGalleries}>
              <NarrowTopBarContext.Provider value={setNarrowTopBar}>
                {children}
              </NarrowTopBarContext.Provider>
            </FamilyGalleriesContext.Provider>
          </HeaderRefContext.Provider>
        </main>
      </div>
    </div>
  )
}
