import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { markdownLink } from '../utils/markdownLink'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PhotoPeople from '../components/PhotoPeople'
import GalleryLargeImage from '../components/GalleryLargeImage'
import GalleryThumbnailStrip from '../components/GalleryThumbnailStrip'
import { getGalleryById } from '../data-access/public/galleries'
import { getLinkedPersons } from '../utils/galleryDisplay'
import { getFullName } from '../utils/personDisplay'

function wrap(index: number, length: number): number {
  return (index + length) % length
}

export default function GalleryPage() {
  const { id } = useParams<{ id: string }>()
  const gallery = getGalleryById(Number(id))
  const photos = gallery?.photos ?? []

  const initialIndex = gallery
    ? Math.max(
        0,
        photos.findIndex((p) => p.image_id === gallery.lead_image_id),
      )
    : 0

  // All hooks are called unconditionally, before the not-found early
  // return below -- react-router can reuse this component instance across
  // navigations within the same route pattern, so the not-found state must
  // not change how many hooks get called between renders.
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [windowStart, setWindowStart] = useState(initialIndex)

  const [renderedGalleryId, setRenderedGalleryId] = useState(gallery?.gallery_id)
  if (renderedGalleryId !== gallery?.gallery_id) {
    setRenderedGalleryId(gallery?.gallery_id)
    setActiveIndex(initialIndex)
    setWindowStart(initialIndex)
  }

  function goPrev() {
    const next = wrap(activeIndex - 1, photos.length)
    setActiveIndex(next)
    setWindowStart(next)
  }

  function goNext() {
    const next = wrap(activeIndex + 1, photos.length)
    setActiveIndex(next)
    setWindowStart(next)
  }

  function selectPhoto(index: number) {
    setActiveIndex(index)
  }

  if (!gallery) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl">
          <p className="text-fe-ink/60 text-sm">
            Gallery not found.{' '}
            <Link to="/galleries" className="text-fe-link hover:text-fe-link-dark">
              Back to Index of Galleries
            </Link>
          </p>
        </div>
      </Layout>
    )
  }

  // A gallery with no photos at all would index photos[activeIndex] to
  // undefined and crash GalleryLargeImage on a required prop. No such
  // gallery exists in the current data (checked directly against the
  // snapshot, not assumed), but galleries are created by hand in the
  // database and an empty one is a perfectly natural intermediate state
  // while assembling it.
  if (photos.length === 0) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl">
          <h1 className="text-xl font-bold mb-2">{gallery.name}</h1>
          <p className="text-fe-ink/60 text-sm">
            This gallery doesn't have any photos yet.{' '}
            <Link to="/galleries" className="text-fe-link hover:text-fe-link-dark">
              Back to Index of Galleries
            </Link>
          </p>
        </div>
      </Layout>
    )
  }

  const linkedPersons = getLinkedPersons(gallery)

  return (
    <Layout>
      <div className="p-6">
        <GalleryLargeImage photo={photos[activeIndex]} onPrev={goPrev} onNext={goNext} />

        {/* Who is in the photograph currently shown -- the point of the
            tagging work, and the only place it is visible. Sits directly
            under the picture rather than with the gallery-wide list
            below, because it describes THIS image and changes as the
            reader moves through the strip.

            Absent entirely for an untagged photograph, which is most of
            them: an empty "In this photograph" heading would read as
            something broken rather than something not yet done. */}
        <PhotoPeople photo={photos[activeIndex]} tone="page" />

        <GalleryThumbnailStrip
          photos={photos}
          activeIndex={activeIndex}
          windowStart={windowStart}
          onWindowPrev={() => setWindowStart((w) => wrap(w - 1, photos.length))}
          onWindowNext={() => setWindowStart((w) => wrap(w + 1, photos.length))}
          onSelect={selectPhoto}
        />

        {/* Headline + back link now sit below the image/caption/thumbnails,
            functioning as a header for the text that follows (summary,
            linked people) rather than a page title crowding the very top. */}
        <div className="max-w-4xl mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
          {/* text-xl/2xl, not text-2xl/3xl -- see FamilyPage.tsx's own
              comment on this: gives a long gallery name more room. */}
          <h1 className="text-xl sm:text-2xl font-bold">{gallery.name}</h1>
          <Link
            to="/galleries"
            className="text-sm text-fe-link hover:text-fe-link-dark shrink-0"
          >
            Back to Index of Galleries
          </Link>
        </div>

        {/* pl-8: a deliberate indent, not an alignment target the way the
            Family page's summary indent lines up with box text -- Gallery
            pages have no equivalent boxes to match, so this is just a
            plain, visible indent per Dad's review notes. */}
        <div className="max-w-4xl pl-8 text-[12px] text-fe-ink">
          <ReactMarkdown components={markdownLink}>{gallery.summary}</ReactMarkdown>
        </div>

        {linkedPersons.length > 0 && (
          <div className="max-w-4xl mt-6">
            {/* Now genuinely everyone in the gallery: the export unions
                the gallery's own people with everyone tagged in any of
                its photographs. Before per-photograph tags existed this
                heading overstated what the data knew -- a picture of two
                brothers listed only the one whose gallery it was. */}
            <h2 className="font-bold text-sm text-fe-brown mb-2">
              Family pages for people in this gallery
            </h2>
            {/* One name per line. Flowed inline they read as a single
                run-on sentence of names, and a long one wrapped into a
                ragged block that was hard to scan for a particular
                person -- which is the only reason anyone reads this
                list. */}
            <ul className="space-y-1 text-sm">
              {linkedPersons.map((person) => (
                <li key={person.person_id}>
                  {person.linkedFamilyId !== null ? (
                    <Link
                      to={`/family/${person.linkedFamilyId}`}
                      className="text-fe-link hover:text-fe-link-dark"
                    >
                      {getFullName(person)}
                    </Link>
                  ) : (
                    getFullName(person)
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  )
}
