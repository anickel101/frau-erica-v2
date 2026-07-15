import { useMemo, useState } from 'react'
import Layout from '../components/Layout'
import GalleryIndexCard from '../components/GalleryIndexCard'
import SearchInput from '../components/SearchInput'
import { mockGalleries } from '../data/mockGallery'
import { getLinkedPersons } from '../utils/galleryDisplay'
import { getFullName } from '../utils/personDisplay'

const PAGE_SIZE = 16

export default function GalleriesPage() {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Each new search starts collapsed at PAGE_SIZE again.
  const [renderedQuery, setRenderedQuery] = useState(query)
  if (renderedQuery !== query) {
    setRenderedQuery(query)
    setShowAll(false)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return mockGalleries
    return mockGalleries.filter((gallery) => {
      if (gallery.name.toLowerCase().includes(q)) return true
      return getLinkedPersons(gallery).some((person) =>
        getFullName(person).toLowerCase().includes(q),
      )
    })
  }, [query])

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE)

  return (
    <Layout>
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold mb-4">Index of Galleries</h1>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search galleries or people..."
        />

        {filtered.length === 0 ? (
          <p className="mt-8 text-fe-ink/60 text-sm">No galleries found.</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
              {visible.map((gallery) => (
                <GalleryIndexCard key={gallery.gallery_id} gallery={gallery} />
              ))}
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-sm text-fe-ink/60 hover:text-fe-ink underline"
                >
                  {showAll ? 'Show less' : 'Show more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
