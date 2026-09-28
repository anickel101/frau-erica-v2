import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import CollectionCard from '../components/CollectionCard'
import Layout from '../components/Layout'
import SearchInput from '../components/SearchInput'
import TextSeriesRow from '../components/TextSeriesRow'
import TextStandaloneRow from '../components/TextStandaloneRow'
import { listCollections } from '../data-access/public/collections'
import { listDocuments } from '../data-access/public/documents'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { TextIndexEntry, filterTextEntries, groupTexts } from '../utils/textDisplay'

const PAGE_SIZE = 14

// How many collection cards the index previews before sending the
// reader to the full shelf. Six fills two rows of three on a wide
// screen and three rows of two on a tablet, so the preview never ends
// on a half-empty row.
const SHELF_PREVIEW = 6

export default function TextsPage() {
  const grouped = useMemo(() => groupTexts(listDocuments()), [])
  const collections = useMemo(() => listCollections(), [])
  const { query, setQuery, filtered, visible, showAll, setShowAll } = usePaginatedSearch(
    grouped,
    filterTextEntries,
    PAGE_SIZE,
  )

  // The shelf is a browsing aid, not a search result. While a query is
  // running it would sit above the matches claiming a relevance it
  // doesn't have, so it steps aside and the list answers the question.
  const searching = query.trim() !== ''

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Index of Texts</h1>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by title or author..."
        />

        {!searching && collections.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-bold text-fe-brown">
                Collections{' '}
                <span className="font-normal text-fe-ink/60">{collections.length}</span>
              </h2>
              {collections.length > SHELF_PREVIEW && (
                <Link
                  to="/collections"
                  className="text-xs text-fe-link hover:text-fe-link-dark"
                >
                  See all {collections.length} &rarr;
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {collections.slice(0, SHELF_PREVIEW).map((collection) => (
                <CollectionCard key={collection.series_key} collection={collection} />
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 ? (
          <p className="mt-8 text-fe-ink/60 text-sm">No texts found.</p>
        ) : (
          <>
            {!searching && (
              <h2 className="mt-8 mb-1 text-sm font-bold text-fe-brown">
                All texts{' '}
                <span className="font-normal text-fe-ink/60">{filtered.length}</span>
              </h2>
            )}
            <div className={searching ? 'mt-8' : ''}>
              {visible.map((f) =>
                f.entry.kind === 'series' ? (
                  <TextSeriesRow
                    key={f.entry.seriesKey}
                    filtered={
                      f as typeof f & {
                        entry: Extract<TextIndexEntry, { kind: 'series' }>
                      }
                    }
                    query={query}
                  />
                ) : (
                  <TextStandaloneRow
                    key={f.entry.document.document_id}
                    document={f.entry.document}
                  />
                ),
              )}
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
