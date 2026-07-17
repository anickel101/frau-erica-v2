import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { GallerySummary } from '../types/family'

interface NavSection {
  title: string
  links: { label: string; to: string }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'About the site',
    links: [
      { label: "User's guide", to: '/about' },
      { label: 'Contact the archivist', to: '/contact' },
    ],
  },
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
}

export default function Sidebar({ dividerOffset, familyGalleries }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const { status, email, personName, homeFamilyId, groups, logout } = useAuth()
  const navigate = useNavigate()

  const logoBlockHeight =
    dividerOffset !== null
      ? Math.max(0, dividerOffset - SIDEBAR_TOP_PADDING - MARGIN_BEFORE_DIVIDER)
      : undefined

  return (
    <>
      {/* Mobile toggle -- visible only below the md breakpoint */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 bg-fe-brown text-white rounded px-3 py-2 text-lg shadow"
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

      <aside
        className={`
          fixed md:static top-0 left-0 h-full md:h-auto w-72 md:w-64
          bg-fe-bg p-6 z-40
          transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          overflow-y-auto
        `}
      >
        {/* Logo block: flag + title + subtitle. Height is live-measured
            (via Layout, see HeaderRefContext) to match whatever the
            current page's header image bottom edge actually is -- no
            more hardcoded numbers to keep in sync by hand. Falls back
            to natural sizing (no forced height) on pages with no header
            image at all. */}
        <div
          className="flex flex-col"
          style={logoBlockHeight !== undefined ? { height: logoBlockHeight } : undefined}
        >
          {/* German flag block -- official ratio is height:width = 3:5,
              i.e. width:height = 5:3. Using aspect-ratio (not a fixed
              height) so it stays correctly proportioned at any sidebar
              width, including the wider mobile drawer. Shrunk to 2/3 of
              the original full-width version -- height follows
              automatically via the aspect ratio. */}
          <div className="w-2/3 aspect-[5/3] mb-4 flex flex-col rounded-sm overflow-hidden shadow-sm">
            <div className="flex-1 bg-black" />
            <div className="flex-1 bg-[#DD0000]" />
            <div className="flex-1 bg-[#FFCE00]" />
          </div>

          {/* mt-auto pushes this block to the bottom of the container
              above, so the text sits flush against the divider that
              follows, regardless of the flag's height. */}
          <div className="mt-auto">
            <p className="text-fe-accent font-bold text-sm leading-tight">
              The Frau Erica Project
            </p>
            <p className="text-fe-brown font-bold text-sm leading-tight">
              Muellers in America:
              <br />
              The First 160 Years
            </p>
          </div>
        </div>

        {/* Account status -- only ever rendered signed in (a signed-out
            visitor sees nothing here). personName/homeFamilyId come from
            a separate GET /persons/:id lookup AuthProvider does after
            sign-in (the token itself only carries person_id, neither a
            name nor a family), so the name briefly falls back to email
            until that resolves -- the name is only a link once
            homeFamilyId is known, since a lookup failure or an
            unlinked/pending account has nowhere to send it to. Also the
            only nav entry point into /admin/users for an admin --
            previously only reachable via a bookmarked URL or the
            one-time Request Access deep-link email. */}
        {status === 'signedIn' && (
          <div className="mt-4 border-t-[1.5px] border-fe-brown pt-3">
            {/* mb-2 + space-y-1 below match NAV_SECTIONS' own
                title-to-links and link-to-link spacing exactly, rather
                than this section drifting with its own hand-tuned gaps. */}
            <p className="text-sm mb-2">
              Hi,{' '}
              {homeFamilyId !== null ? (
                <Link
                  to={`/family/${homeFamilyId}`}
                  onClick={() => setOpen(false)}
                  className="font-bold text-fe-brown hover:text-fe-accent"
                >
                  {personName ?? email}
                </Link>
              ) : (
                <span className="font-bold text-fe-brown">{personName ?? email}</span>
              )}
            </p>
            <div className="space-y-1">
              {groups.includes('admin') && (
                <p>
                  <Link
                    to="/admin/users"
                    onClick={() => setOpen(false)}
                    className="text-fe-accent hover:text-fe-accent-dark text-sm"
                  >
                    Manage users
                  </Link>
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  logout()
                  setOpen(false)
                  navigate('/login')
                }}
                className="text-fe-accent hover:text-fe-accent-dark text-sm"
              >
                Log out
              </button>
            </div>
          </div>
        )}

        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mt-4 border-t-[1.5px] border-fe-brown pt-3">
            <p className="font-bold text-sm mb-2 text-fe-brown">{section.title}</p>
            <ul className="space-y-1">
              {section.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-fe-accent hover:text-fe-accent-dark text-sm"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Family page-specific -- only present when the current family's
            couple has at least one linked gallery (see getLinkedGalleries
            in api/'s queries/families.ts). Absent entirely everywhere
            else, including family pages with no linked galleries. */}
        {familyGalleries && familyGalleries.length > 0 && (
          <div className="mt-4 border-t-[1.5px] border-fe-brown pt-3">
            <p className="font-bold text-sm mb-2 text-fe-brown">Galleries</p>
            <ul className="space-y-1">
              {familyGalleries.map((gallery) => (
                <li key={gallery.gallery_id}>
                  <Link
                    to={`/galleries/${gallery.gallery_id}`}
                    className="text-fe-accent hover:text-fe-accent-dark text-sm"
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
