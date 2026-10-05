import { Link } from 'react-router-dom'
import { Person } from '../types/person'

// Shared by TextStandaloneRow, TextSeriesRow, and TextPage -- the caller
// wraps this in its own <p> (font size/spacing differ between index rows
// and the detail page), this only owns the author-link-or-plain-text and
// genre-separator logic that was previously copy-pasted three times.
export default function TextByline({
  author,
  authorPerson,
  genre,
}: {
  author: string | null
  authorPerson: Person | undefined
  genre: string | null
}) {
  return (
    <>
      {/* The author string is always what's PRINTED; authorPerson only
          decides whether it links.

          This used to print getFullName(authorPerson) whenever a person
          was attached, which quietly overrode the byline the archive
          had been given: the Chicago Memoirs are signed "Joel Nickel"
          and came out as "Joel Thomas Nickel", his full name in
          Persons. A byline is how someone signs their work, not how
          their record spells them -- and the names this family actually
          uses ("Nana", "Opa", "Tante Fieks") would have fared worse
          still. Persons is the right place to look up WHO, and the
          wrong place to look up what to call them here. */}
      {author &&
        (authorPerson?.linkedFamilyId != null ? (
          <Link
            to={`/family/${authorPerson.linkedFamilyId}`}
            className="text-fe-link hover:text-fe-link-dark"
          >
            {author}
          </Link>
        ) : (
          <span>{author}</span>
        ))}
      {genre && (
        <span className={author ? 'ml-2 text-fe-ink/40' : 'text-fe-ink/40'}>
          {author ? '· ' : ''}
          {genre}
        </span>
      )}
    </>
  )
}
