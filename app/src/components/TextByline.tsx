import { Link } from 'react-router-dom'
import { ByAuthor } from '../utils/textDisplay'

// Shared by TextStandaloneRow, TextSeriesRow, TextPage and CollectionPage
// -- the caller wraps this in its own <p> (font size/spacing differ
// between index rows and the detail pages), this only owns the
// author-link-or-plain-text and genre-separator logic that was
// previously copy-pasted three times.
//
// Takes a LIST of authors, even where there can only be one. A document
// has at most one author; a collection has as many as its chapters name,
// and Fritz Mueller's journal has two. Giving the single case a
// one-element list keeps one rendering path instead of two that can
// drift -- the drift formStyles.ts exists to prevent, which had already
// happened there once.
export default function TextByline({
  authors,
  genre,
}: {
  authors: ByAuthor[]
  genre: string | null
}) {
  return (
    <>
      {/* The author string is always what's PRINTED; the person record
          only decides whether it links.

          This used to print getFullName(person) whenever a person was
          attached, which quietly overrode the byline the archive had
          been given: the Chicago Memoirs are signed "Joel Nickel" and
          came out as "Joel Thomas Nickel", his full name in Persons. A
          byline is how someone signs their work, not how their record
          spells them -- and the names this family actually uses
          ("Nana", "Opa", "Tante Fieks") would have fared worse still.
          Persons is the right place to look up WHO, and the wrong place
          to look up what to call them here. */}
      {authors.map((author, index) => (
        <span key={author.name}>
          {index > 0 && ', '}
          {author.person?.linkedFamilyId != null ? (
            <Link
              to={`/family/${author.person.linkedFamilyId}`}
              className="text-fe-link hover:text-fe-link-dark"
            >
              {author.name}
            </Link>
          ) : (
            <span>{author.name}</span>
          )}
        </span>
      ))}
      {genre && (
        <span className={authors.length > 0 ? 'ml-2 text-fe-ink/40' : 'text-fe-ink/40'}>
          {authors.length > 0 ? '· ' : ''}
          {genre}
        </span>
      )}
    </>
  )
}
