import { useMemo } from 'react'
import Layout from '../components/Layout'
import SearchInput from '../components/SearchInput'
import TextSeriesRow from '../components/TextSeriesRow'
import TextStandaloneRow from '../components/TextStandaloneRow'
import { mockTexts } from '../data/mockTexts'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { TextIndexEntry, filterTextEntries, groupTexts } from '../utils/textDisplay'

const PAGE_SIZE = 14

export default function TextsPage() {
  const grouped = useMemo(() => groupTexts(mockTexts), [])
  const { query, setQuery, filtered, visible, showAll, setShowAll } = usePaginatedSearch(
    grouped,
    filterTextEntries,
    PAGE_SIZE,
  )

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Index of Texts</h1>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by title or author..."
        />

        {filtered.length === 0 ? (
          <p className="mt-8 text-fe-ink/60 text-sm">No texts found.</p>
        ) : (
          <>
            <div className="mt-8">
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
