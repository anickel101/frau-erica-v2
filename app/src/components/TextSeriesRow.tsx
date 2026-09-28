import { Link } from 'react-router-dom'
import {
  TextIndexEntry,
  FilteredTextEntry,
  getAuthorPerson,
  getSeriesRepresentative,
} from '../utils/textDisplay'
import InlineMarkdown from './InlineMarkdown'
import TextByline from './TextByline'

type SeriesEntry = Extract<TextIndexEntry, { kind: 'series' }>

// A collection, as one row of the Index of Texts.
//
// The expand-in-place toggle this used to carry is gone. Browsing a
// collection is what the collection page is for -- it has the cover, the
// blurb, and an order chosen to suit the kind -- and a list that grew by
// twenty-eight rows inside the index was never a good way to read a run
// of Christmas letters.
//
// Chapters still appear inline in one case: a search. Then the point is
// not to browse the collection but to see WHICH texts inside it matched,
// and sending the reader to another page to find that out would lose the
// answer they just asked for.
export default function TextSeriesRow({
  filtered,
  query,
}: {
  filtered: FilteredTextEntry & { entry: SeriesEntry }
  query: string
}) {
  const { entry, matchedChapterIds } = filtered
  const representative = getSeriesRepresentative(entry.chapters)
  const authorPerson = getAuthorPerson(representative)
  const { collection } = entry

  const searching = query.trim() !== ''
  const matched = searching
    ? entry.chapters.filter((c) => matchedChapterIds.includes(c.document_id))
    : []

  // The collection page where there is one. A group with no Series row
  // falls back to its own leading chapter, so the row is never a dead
  // link -- though the export refuses to ship that state.
  const to = collection
    ? `/collections/${collection.slug}`
    : `/documents/${representative.document_id}`

  // The collection's own blurb says what the whole thing is; the
  // representative chapter's summary describes one chapter of it. Prefer
  // the blurb, which is written for exactly this row.
  const description = collection?.blurb ?? representative.summary

  return (
    <article className="py-3 border-b border-fe-brown/20">
      <Link to={to} className="text-base font-bold text-fe-ink hover:text-fe-link-dark">
        {entry.seriesTitle}
      </Link>
      <p className="text-xs text-fe-ink/70 mt-0.5">
        <TextByline
          author={representative.author}
          authorPerson={authorPerson}
          genre={representative.genre}
        />
      </p>
      {description && (
        <p className="text-xs text-fe-ink/80 mt-1 line-clamp-2">
          <InlineMarkdown>{description}</InlineMarkdown>
        </p>
      )}

      {matched.length > 0 ? (
        <ol className="mt-1.5 ml-4 space-y-0.5 text-xs">
          {matched.map((chapter) => (
            <li key={chapter.document_id}>
              <Link
                to={`/documents/${chapter.document_id}`}
                className="text-fe-link hover:text-fe-link-dark"
              >
                {/* series_order 0 marks the piece that introduces the
                    rest rather than a chapter of it, and a null order
                    means none was recorded -- neither should print a
                    number. Falsy check rather than === 0 so both cases
                    are covered. */}
                {chapter.series_order ? `${chapter.series_order}. ` : ''}
                {chapter.title}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <Link
          to={to}
          className="mt-1 inline-block text-xs text-fe-link hover:text-fe-link-dark"
        >
          {countLabel(entry)} &rarr;
        </Link>
      )}
    </article>
  )
}

function countLabel(entry: SeriesEntry): string {
  const n = entry.chapters.length
  if (entry.collection?.kind === 'annual') return `All ${n} letters`
  if (entry.collection?.kind === 'person') return `All ${n} texts`
  return `All ${n} chapters`
}
