import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import InlineMarkdown from '../components/InlineMarkdown'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { mockPersons } from '../data/mockPersons'
import type { LinkedPhoto } from '../data-access/public/personLinks'
import { usePersonLinks } from '../hooks/usePersonLinks'
import { getFullName } from '../utils/personDisplay'

// Every photograph of one person -- where a pop-up's "See all" goes.
//
// The Archivist's ask was that "every portrait in the database could be
// easily discoverable", without anyone having to build a gallery for
// each person. This is that gallery, built from the photo tags alone, so
// it grows as tagging does and nobody maintains it.
//
// Gated like the pop-up it comes from, though everything on it is public
// elsewhere: it is part of the family-tree experience, not a new public
// index of the archive by person.
export default function PersonPhotosPage() {
  const { id } = useParams<{ id: string }>()
  const personId = Number(id)
  const index = usePersonLinks()
  const navigate = useNavigate()
  const location = useLocation()
  const [zoomed, setZoomed] = useState<LinkedPhoto | null>(null)

  const person = mockPersons.find((p) => p.person_id === personId)
  const photos = index?.(personId)?.photos ?? []
  const name = person ? getFullName(person) : 'this person'

  // Back to wherever the reader came from -- normally the family page
  // with the pop-up still open (see FamilyPage's ?about=). Arriving from
  // outside the site (a pasted link) there is no "from", so it falls back
  // to their family page with the pop-up opened.
  const cameFromSite = location.key !== 'default'
  const fallback =
    person?.linkedFamilyId != null
      ? `/family/${person.linkedFamilyId}?about=${personId}`
      : '/persons'

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <p className="text-sm text-fe-brown mb-1">
          {cameFromSite ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cursor-pointer hover:text-fe-link-dark"
            >
              Back
            </button>
          ) : (
            <Link to={fallback} className="hover:text-fe-link-dark">
              Family page
            </Link>
          )}
        </p>
        <h1 className="text-xl sm:text-2xl font-bold mb-4">Photographs of {name}</h1>

        {index === null ? (
          <p className="text-sm text-fe-ink/60">Loading...</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-fe-ink/60">No photographs of {name} yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {photos.map((photo) => (
              <li key={photo.image_id}>
                <button
                  type="button"
                  onClick={() => setZoomed(photo)}
                  aria-label="Enlarge photograph"
                  className="block aspect-square w-full cursor-zoom-in overflow-hidden border-2 border-transparent bg-fe-brown/20 transition hover:border-fe-accent focus-visible:border-fe-accent focus-visible:outline-none"
                >
                  <img
                    src={photo.src}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover object-top"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Same stacked-caption zoom as an embedded document image (see
          DocumentEmbeddedImage), so a photograph reads the same wherever
          it is opened. */}
      <Modal open={zoomed !== null} onClose={() => setZoomed(null)}>
        {zoomed && (
          <div className="flex max-h-[90vh] max-w-[90vw] cursor-zoom-out flex-col">
            <img
              src={zoomed.src}
              alt=""
              className={`max-w-[90vw] object-contain ${zoomed.caption ? 'max-h-[calc(90vh-6rem)]' : 'max-h-[90vh]'}`}
            />
            {zoomed.caption && (
              <div className="mt-3 rounded-sm bg-black/60 p-4 text-sm text-white/80">
                <InlineMarkdown>{zoomed.caption}</InlineMarkdown>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  )
}
