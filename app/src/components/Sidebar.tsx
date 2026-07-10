import { useState } from 'react'
import { Link } from 'react-router-dom'

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
      { label: 'Index of persons', to: '/persons' },
      { label: 'Photo galleries', to: '/galleries' },
      { label: 'Index of texts', to: '/documents' },
      { label: 'The Mueller Lexicon', to: '/lexicon' },
    ],
  },
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)

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
          bg-fe-bg border-r-4 border-fe-brown p-6 z-40
          transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          overflow-y-auto
        `}
      >
        {/* German flag block */}
        <div className="w-full h-16 mb-4 flex flex-col rounded-sm overflow-hidden shadow-sm">
          <div className="flex-1 bg-black" />
          <div className="flex-1 bg-[#DD0000]" />
          <div className="flex-1 bg-[#FFCE00]" />
        </div>

        <p className="text-fe-accent font-bold text-sm leading-tight">
          The Frau Erica Project
        </p>
        <p className="text-fe-ink font-bold text-sm leading-tight mb-4">
          Muellers in America: The first 160 years
        </p>

        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mt-4 border-t border-fe-brown/40 pt-3">
            <p className="font-bold text-sm mb-2">{section.title}</p>
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
      </aside>
    </>
  )
}
