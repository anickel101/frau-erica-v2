import { RefObject, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { GallerySummary } from '../types/family'
import { getYearsSinceArrival } from '../utils/arrivalAnniversary'

interface NavSection {
  title: string
  links: { label: string; to: string }[]
}

// Shared by every clickable link in this sidebar (nav sections, account
// links, galleries) -- one canonical string instead of four independently
// drifting copies. Bold + a size step down from the old text-sm, per
// Dad's review notes.
const NAV_LINK_CLASS = 'font-bold text-fe-link hover:text-fe-link-dark text-xs'

// "About the site" is deliberately NOT in this list. Per Opa's review it
// now leads the sidebar and carries the signed-in identity, Manage users
// and Log out alongside its two static links -- a mix of dynamic and
// static entries that the plain title+links shape here can't express, so
// it's rendered explicitly below instead.
const ABOUT_LINKS: { label: string; to: string; state?: unknown }[] = [
  // Home carries `stay` because "/" redirects a signed-in member to
  // their own family page (see components/homeDestination.ts) -- without
  // it this link would bounce straight back where it came from, which is
  // worse than having no link at all. The flag marks the difference
  // between arriving at the site and deliberately asking for this page.
  { label: 'Home', to: '/', state: { stay: true } },
  { label: "User's Guide", to: '/about' },
  { label: 'Contact the Archivist', to: '/contact' },
]

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Explorations',
    links: [
      { label: 'Index of Persons', to: '/persons' },
      { label: 'Index of Galleries', to: '/galleries' },
      { label: 'Index of Texts', to: '/documents' },
      { label: 'The Mueller Lexicon', to: '/lexicon' },
      { label: 'Today in Frau Erica', to: '/anniversaries' },
    ],
  },
]

// This sidebar's OWN spacing choices -- these are local to this file by
// design, unlike the old hardcoded cross-file guess. If either changes,
// the height calculation below is right here to update alongside it.
const SIDEBAR_TOP_PADDING = 24 // p-6
const MARGIN_BEFORE_DIVIDER = 16 // mt-4 on the first nav section

// Guaranteed minimum gap between the end of the logo text and the
// divider that follows it, on pages with no header image to align with
// (see logoBlockHeight below -- there's no measured offset to size the
// logo block against in that case).
const MIN_GAP_WITHOUT_HEADER_IMAGE = 200

interface SidebarProps {
  /** Live-measured distance from the shared content top edge to the
   * header image's bottom edge, provided by Layout. Null when the
   * current page has no header image to align with. */
  dividerOffset: number | null
  /** Galleries linked to the featured couple on the current Family page,
   * pushed out via useSetFamilyGalleries() (see Layout.tsx). Null on
   * every other page, or an empty array when this family has none --
   * either way, the section just doesn't render. */
  familyGalleries: GallerySummary[] | null
  /** Layout measures this against the header image's right edge to
   * position the Family-page-only width-matched top accent bar (see
   * useNarrowTopBar.tsx). Attached here rather than passed as a
   * computed value, matching the same live-measurement approach as
   * dividerOffset above -- the logo's actual left edge is what matters,
   * not a hardcoded padding assumption. */
  logoRef: RefObject<HTMLDivElement | null>
}

export default function Sidebar({
  dividerOffset,
  familyGalleries,
  logoRef,
}: SidebarProps) {
  const [open, setOpen] = useState(false)
  const { status, email, personName, homeFamilyId, groups, ancestralLines, logout } =
    useAuth()
  const navigate = useNavigate()

  const logoBlockHeight =
    dividerOffset !== null
      ? Math.max(0, dividerOffset - SIDEBAR_TOP_PADDING - MARGIN_BEFORE_DIVIDER)
      : undefined

  return (
    <>
      {/* Mobile toggle -- visible only below the md breakpoint. Flush with
          the true top-left corner (not top-3/left-3, which left a gap)
          and the same bg-fe-accent as the top accent bar, so the two
          blocks read as one continuous shape rather than a separate
          floating pill. Only the bottom-right corner rounds off -- top
          (against the bar) and left (against the page's own edge) both
          stay square, since those are the two sides actually touching
          something else; rounding them would put small notches of page
          background right at the browser's own edges. Bottom-right is
          the only side that's genuinely "free," floating into the page
          content. */}
      <button
        className="md:hidden fixed top-0 left-0 z-50 w-14 h-14 flex items-center justify-center bg-fe-accent text-white text-3xl rounded-br-xl"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>

      {/* Backdrop, mobile only, closes menu on tap outside */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* invisible (not just translated off-screen) when the mobile
          drawer is closed. A transform alone moves the panel out of
          sight but leaves it in the tab order, so on a phone the first
          ~15 tab presses walked through links nobody could see -- the
          focus ring appearing to vanish into the left edge of the
          screen. visibility:hidden removes it from the tab order;
          md:visible brings it back on desktop, where the drawer is
          always open regardless of `open`, so this can't be driven off
          that state alone.

          visibility is in the transition list so it flips only after the
          slide-out finishes -- without that the panel disappears
          instantly instead of sliding away.

          The list has to name `translate` explicitly, not just
          `transform`: Tailwind v4 implements -translate-x-full via the
          separate CSS `translate` property, and its own
          `transition-transform` shorthand covers transform/translate/
          scale/rotate together. Writing transition-[transform,visibility]
          silently dropped `translate` and made the drawer snap rather
          than slide -- caught by reading the computed style, since it
          still looked plausible in the class list. */}
      <aside
        className={`
          fixed md:static top-0 left-0 h-full md:h-auto w-72 md:w-64
          bg-fe-bg p-6 z-40
          transform transition-[transform,translate,scale,rotate,visibility]
          duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full invisible'}
          md:translate-x-0 md:visible
          overflow-y-auto
        `}
      >
        {/* Logo block: flag + title + subtitle, top-aligned (the text
            sits right under the flag), then a spacer that absorbs
            whatever room is left. Height is live-measured (via Layout,
            see HeaderRefContext) to match whatever the current page's
            header image bottom edge actually is -- no more hardcoded
            numbers to keep in sync by hand. Falls back to natural sizing
            (no forced height) on pages with no header image at all. */}
        <div
          ref={logoRef}
          className="flex flex-col"
          style={logoBlockHeight !== undefined ? { height: logoBlockHeight } : undefined}
        >
          {/* German flag block -- official ratio is height:width = 3:5,
              i.e. width:height = 5:3. Using aspect-ratio (not a fixed
              height) so it stays correctly proportioned at any sidebar
              width, including the wider mobile drawer. 4/9 of the
              original full-width version: previously shrunk to 2/3, then
              shrunk by a further 1/3 of that (2/3 * 2/3) -- height
              follows automatically via the aspect ratio. */}
          <div className="w-[calc(100%*4/9)] aspect-[5/3] mb-4 flex flex-col rounded-sm overflow-hidden shadow-sm">
            <div className="flex-1 bg-black" />
            <div className="flex-1 bg-[#DD0000]" />
            <div className="flex-1 bg-[#FFCE00]" />
          </div>

          <div>
            <p className="text-fe-link font-bold text-sm leading-tight">
              The Frau Erica Project
            </p>
            <p className="text-fe-brown font-bold text-sm leading-tight">
              Muellers in America:
              <br />
              The First {getYearsSinceArrival()} Years
            </p>
          </div>

          {/* Spacer, not the text block itself, absorbs the leftover
              room -- keeps the flag+text pinned together at the top
              instead of being stretched apart. With a header image,
              flex-1 fills up to the measured height above so the divider
              that follows this whole div still lands exactly at the
              header image's bottom edge; without one, a fixed minimum
              keeps the divider from crowding the logo text. */}
          {logoBlockHeight !== undefined ? (
            <div className="flex-1" />
          ) : (
            <div style={{ height: MIN_GAP_WITHOUT_HEADER_IMAGE }} />
          )}
        </div>

        {/* "About the site" leads the sidebar and carries the signed-in
            identity and Log out, per Opa's review -- previously the
            account block sat above an "About the site" section that held
            only two static links, and Log out was buried among the
            ancestry links.

            "Logged in: {name}" rather than "Hi, {name}", also his call:
            a greeting is warm the first couple of times and then just
            takes up space in something people use as navigation.

            personName/homeFamilyId come from a separate GET /persons/:id
            lookup AuthProvider does after sign-in (the token carries
            person_id, neither a name nor a family), so the name briefly
            falls back to email until that resolves -- and is only a link
            once homeFamilyId is known, since a lookup failure or an
            unlinked/pending account has nowhere to send it. */}
        <div className="mt-4 border-t-[1.5px] border-fe-brown pt-3">
          <p className="font-bold text-sm mb-2 text-fe-brown">About the site</p>
          {status === 'signedIn' && (
            <p className="text-sm mb-2">
              Logged in:{' '}
              {homeFamilyId !== null ? (
                <Link
                  to={`/family/${homeFamilyId}`}
                  onClick={() => setOpen(false)}
                  className="font-bold text-fe-brown hover:text-fe-link"
                >
                  {personName ?? email}
                </Link>
              ) : (
                <span className="font-bold text-fe-brown">{personName ?? email}</span>
              )}
            </p>
          )}
          <ul className="space-y-0.5">
            {ABOUT_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  state={link.state}
                  className={NAV_LINK_CLASS}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {/* The only nav entry point into /admin/users -- otherwise
                reachable solely by a bookmark or the one-time Request
                Access deep-link email. */}
            {status === 'signedIn' && groups.includes('admin') && (
              <li>
                <Link
                  to="/admin/users"
                  onClick={() => setOpen(false)}
                  className={NAV_LINK_CLASS}
                >
                  Manage users
                </Link>
              </li>
            )}
            {status === 'signedIn' && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    // logout() clears local state in a finally block, so
                    // it resolves even when the Cognito call fails --
                    // navigating without awaiting is safe, and awaiting
                    // would leave the person on the page they just asked
                    // to leave until a network round-trip finished.
                    void logout()
                    setOpen(false)
                    navigate('/login')
                  }}
                  className={NAV_LINK_CLASS}
                >
                  Log out
                </button>
              </li>
            )}
          </ul>
        </div>

        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mt-4 border-t-[1.5px] border-fe-brown pt-3">
            <p className="font-bold text-sm mb-2 text-fe-brown">{section.title}</p>
            <ul className="space-y-0.5">
              {section.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className={NAV_LINK_CLASS}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Ancestry -- its own section again, per Opa's review ("consider
            returning the Ancestry element to the sidebar"). It used to
            be a couple of loose links inside the account block.

            One link per ancestral line, labeled "First {Surname}" after
            the furthest known ancestor on that line -- computed from
            data we already hold, with no manual surname curation (the
            old site hand-tagged this per person). "(via {name})" stays
            alongside: not only for the "no gender field" reason it was
            added for, but because it's the only thing separating two
            lines' text on the ~0.6% of real pages where both converge on
            the same furthest ancestor. Absent entirely until the lookup
            resolves, or when no biological parents are on record. */}
        {ancestralLines && ancestralLines.length > 0 && (
          <div className="mt-4 border-t-[1.5px] border-fe-brown pt-3">
            <p className="font-bold text-sm mb-2 text-fe-brown">Ancestry</p>
            <ul className="space-y-0.5">
              {ancestralLines.map((line) => (
                <li key={line.viaId}>
                  <Link
                    to={
                      line.furthestAncestor.linkedFamilyId !== null
                        ? `/family/${line.furthestAncestor.linkedFamilyId}`
                        : `/persons/${line.furthestAncestor.person_id}`
                    }
                    onClick={() => setOpen(false)}
                    className={NAV_LINK_CLASS}
                  >
                    First {line.furthestAncestor.last_name} (via {line.viaName})
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Family page-specific -- only present when the current family's
            couple has at least one linked gallery (see getLinkedGalleries
            in api/'s queries/families.ts). Absent entirely everywhere
            else, including family pages with no linked galleries. */}
        {familyGalleries && familyGalleries.length > 0 && (
          <div className="mt-4 border-t-[1.5px] border-fe-brown pt-3">
            <p className="font-bold text-sm mb-2 text-fe-brown">Galleries</p>
            <ul className="space-y-0.5">
              {familyGalleries.map((gallery) => (
                <li key={gallery.gallery_id}>
                  <Link
                    to={`/galleries/${gallery.gallery_id}`}
                    className={NAV_LINK_CLASS}
                    onClick={() => setOpen(false)}
                  >
                    {gallery.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </>
  )
}
