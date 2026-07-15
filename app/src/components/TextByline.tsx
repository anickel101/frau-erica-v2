import { Link } from 'react-router-dom'
import { Person } from '../data/mockPersons'
import { MOCK_FAMILY_LINK, getFullName } from '../utils/personDisplay'

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
      {author &&
        (authorPerson ? (
          <Link
            to={MOCK_FAMILY_LINK}
            className="text-fe-accent hover:text-fe-accent-dark"
          >
            {getFullName(authorPerson)}
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
