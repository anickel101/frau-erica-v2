import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import GalleryLargeImage from '../components/GalleryLargeImage'
import GalleryThumbnailStrip from '../components/GalleryThumbnailStrip'
import { mockGalleries } from '../data/mockGallery'
import { getLinkedPersons } from '../utils/galleryDisplay'
import { getFullName, MOCK_FAMILY_LINK } from '../utils/personDisplay'

function wrap(index: number, length: number): number {
  return (index + length) % length
}

export default function GalleryPage() {
  const { id } = useParams<{ id: string }>()
  const gallery =
    mockGalleries.find((g) => g.gallery_id === Number(id)) ?? mockGalleries[0]
  const { photos } = gallery

  const initialIndex = Math.max(
    0,
    photos.findIndex((p) => p.image_id === gallery.lead_image_id),
  )

  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [windowStart, setWindowStart] = useState(initialIndex)

  // Navigating between two gallery pages (e.g. via Links, not a full
  // reload) reuses this component instance -- reset to the new gallery's
  // own lead photo rather than keeping the previous gallery's index.
  const [renderedGalleryId, setRenderedGalleryId] = useState(gallery.gallery_id)
  if (renderedGalleryId !== gallery.gallery_id) {
    setRenderedGalleryId(gallery.gallery_id)
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

  const linkedPersons = getLinkedPersons(gallery)

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">{gallery.name}</h1>

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
