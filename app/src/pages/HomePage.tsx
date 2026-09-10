import { Link, Navigate, useLocation } from 'react-router-dom'
import Layout from '../components/Layout'
import { resolveHomeDestination } from '../components/homeDestination'
import RandomHeaderImage from '../components/RandomHeaderImage'
import { useAuth } from '../hooks/useAuth'
import { getAllGalleryPhotos, pickRandomPhoto } from '../utils/randomPhoto'

// Picked once at module load (not during render, which must stay pure) --
// two different photos, same approach as ContactPage.tsx/UsersGuidePage.tsx.
const allPhotos = getAllGalleryPhotos()
const HEADER_PHOTO = pickRandomPhoto(allPhotos)
const remainingPhotos = allPhotos.filter((p) => p.image_id !== HEADER_PHOTO?.image_id)
const SECOND_PHOTO = pickRandomPhoto(remainingPhotos)

const EXPLORE_LINKS = [
  { label: 'Index of Persons', to: '/persons' },
  { label: 'Index of Galleries', to: '/galleries' },
  { label: 'Index of Texts', to: '/documents' },
  { label: 'The Mueller Lexicon', to: '/lexicon' },
]

export default function HomePage() {
  const { status, personId, groups } = useAuth()
  // Set by the sidebar's Home link. Someone who deliberately asked for
  // this page gets it, rather than being redirected back to the family
  // page they just navigated away from -- the redirect is about where to
  // LAND on arrival, not a rule that this page is off limits.
  const askedForHome = (useLocation().state as { stay?: boolean } | null)?.stay === true
  const destination = askedForHome
    ? ({ kind: 'home' } as const)
    : resolveHomeDestination(status, personId, groups)

  // A signed-in family member goes straight to their own family page.
  // One redirect covers both entry points: LoginForm already navigates
  // here after a successful sign-in, and someone typing frauerica.org
  // months later arrives here too -- so neither needed its own rule.
  //
  // Via /persons/:id rather than /family/:id, because person_id is on
  // the ID token and needs no lookup, while the family page it maps to
  // does. PersonPage already performs exactly that resolution.
  //
  // `replace`, not a push -- otherwise Back from the family page returns
  // here and is immediately redirected forward again, trapping them.
  //
  // The `landing` flag tells PersonPage this is a pass-through rather
  // than a destination, so it stays blank instead of showing "Loading..."
  // and the two hops read as one navigation. See PersonPage for why that
  // is opt-in rather than its default.
  if (destination.kind === 'person') {
    return (
      <Navigate
        to={`/persons/${destination.personId}`}
        replace
        state={{ landing: true }}
      />
    )
  }

  // Blank, not the home page, while the session resolves: rendering the
  // welcome and replacing it a moment later reads as a glitch. Only one
  // tick for signed-out visitors, who then get 'home' properly.
  if (destination.kind === 'resolving') return null

  return (
    <Layout>
      <div className="p-6">
        <RandomHeaderImage photo={HEADER_PHOTO} />

        <div className="max-w-4xl mt-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">
            Welcome to FrauErica.org
          </h1>
          <p className="mb-8">
            FrauErica.org is a family history archive built around the Mueller family
            tree, beginning with Georg and Gertrude Mueller in the Napoleonic era and
            continuing down through the generations to the present day. Explore letters,
            memoirs, and photographs gathered from family archives over many years, along
            with a running glossary of the German words and phrases that have stuck around
            in the family's daily speech.
          </p>

          {SECOND_PHOTO && (
            <div className="mb-8 max-w-sm">
              <img src={SECOND_PHOTO.url} alt="" className="w-full rounded-sm" />
              {(SECOND_PHOTO.title || SECOND_PHOTO.caption) && (
                <p className="mt-2 text-sm text-fe-ink/70">
                  {SECOND_PHOTO.title && (
                    <strong className="text-fe-ink">{SECOND_PHOTO.title}</strong>
                  )}
                  {SECOND_PHOTO.title && SECOND_PHOTO.caption && ' -- '}
                  {SECOND_PHOTO.caption}
                </p>
              )}
            </div>
          )}

          <h2 className="text-xl font-bold text-fe-brown mb-2">Explore the archive</h2>
          <ul className="space-y-1">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-fe-link hover:text-fe-link-dark">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  )
}
