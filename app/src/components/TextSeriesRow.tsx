import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TextIndexEntry,
  FilteredTextEntry,
  getAuthorPerson,
  getSeriesRepresentative,
} from '../utils/textDisplay'
import TextByline from './TextByline'

type SeriesEntry = Extract<TextIndexEntry, { kind: 'series' }>

export default function TextSeriesRow({
  filtered,
  query,
}: {
  filtered: FilteredTextEntry & { entry: SeriesEntry }
  query: string
}) {
  const { entry, autoExpand } = filtered
  const representative = getSeriesRepresentative(entry.chapters)
  const authorPerson = getAuthorPerson(representative)

  const [open, setOpen] = useState(autoExpand)

  // Every search-query change re-derives whether this series should be
  // expanded from the freshly computed autoExpand value, discarding any
  // manual toggle left over from the previous query -- same render-time
  // reset idiom GalleriesPage.tsx uses for renderedQuery/showAll.
  const [renderedQuery, setRenderedQuery] = useState(query)
  if (renderedQuery !== query) {
    setRenderedQuery(query)
    setOpen(autoExpand)
  }

  return (
    <article className="py-3 border-b border-fe-brown/20">
      <Link
        to={`/documents/${representative.document_id}`}
        className="text-base font-bold text-fe-ink hover:text-fe-accent-dark"
      >
        {entry.seriesTitle}
      </Link>
      <p className="text-xs text-fe-ink/70 mt-0.5">
        <TextByline
          author={representative.author}
          authorPerson={authorPerson}
          genre={representative.genre}
        />
      </p>
      {representative.summary && (
        <p className="text-xs text-fe-ink/80 mt-1">{representative.summary}</p>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-1 text-xs text-fe-ink/60 hover:text-fe-ink underline"
      >
        {open ? 'Hide chapters' : `Show ${entry.chapters.length} chapters`}
      </button>

      {open && (
        <ol className="mt-1.5 ml-4 space-y-0.5 text-xs">
          {entry.chapters.map((chapter) => (
            <li key={chapter.document_id}>
              <Link
                to={`/documents/${chapter.document_id}`}
                className="text-fe-accent hover:text-fe-accent-dark"
              >
                {chapter.series_order}. {chapter.title}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}
