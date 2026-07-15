import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import GalleryLargeImage from '../components/GalleryLargeImage'
import GalleryThumbnailStrip from '../components/GalleryThumbnailStrip'
import { getGalleryById } from '../data-access/public/galleries'
import { getLinkedPersons } from '../utils/galleryDisplay'
import { getFullName, MOCK_FAMILY_LINK } from '../utils/personDisplay'

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
            <Link to="/galleries" className="text-fe-accent hover:text-fe-accent-dark">
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
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">{gallery.name}</h1>
          <Link
            to="/galleries"
            className="text-sm text-fe-accent hover:text-fe-accent-dark shrink-0"
          >
            Back to Index of Galleries
          </Link>
        </div>

        <GalleryLargeImage photo={photos[activeIndex]} onPrev={goPrev} onNext={goNext} />

        <GalleryThumbnailStrip
          photos={photos}
          activeIndex={activeIndex}
          windowStart={windowStart}
          onWindowPrev={() => setWindowStart((w) => wrap(w - 1, photos.length))}
          onWindowNext={() => setWindowStart((w) => wrap(w + 1, photos.length))}
          onSelect={selectPhoto}
        />

        <div className="max-w-4xl mt-8 prose prose-sm text-fe-ink/90">
          <ReactMarkdown>{gallery.summary}</ReactMarkdown>
        </div>

        {linkedPersons.length > 0 && (
          <div className="max-w-4xl mt-6">
            <h2 className="font-bold text-sm text-fe-brown mb-2">
              People in this gallery
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {linkedPersons.map((person) => (
                <li key={person.person_id}>
                  <Link
                    to={MOCK_FAMILY_LINK}
                    className="text-fe-accent hover:text-fe-accent-dark"
                  >
                    {getFullName(person)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  )
}
