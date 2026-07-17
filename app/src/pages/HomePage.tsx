import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import RandomHeaderImage from '../components/RandomHeaderImage'
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
                <Link to={link.to} className="text-fe-accent hover:text-fe-accent-dark">
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
