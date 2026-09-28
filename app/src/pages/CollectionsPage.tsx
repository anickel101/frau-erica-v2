import CollectionCard from '../components/CollectionCard'
import Layout from '../components/Layout'
import { listCollections } from '../data-access/public/collections'

// Every collection, on one shelf. The Index of Texts shows the same
// cards above its list of single texts; this page is where they all are
// when that preview isn't enough.
export default function CollectionsPage() {
  const collections = listCollections()
  const total = collections.reduce((n, c) => n + c.chapterCount, 0)

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-1">Collections</h1>
        <p className="text-sm text-fe-ink/70 mb-6">
          {collections.length} collections, holding {total} texts.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.series_key} collection={collection} />
          ))}
        </div>
      </div>
    </Layout>
  )
}
