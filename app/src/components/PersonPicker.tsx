import { useEffect, useState } from 'react'
import { searchPersons } from '../data-access/gated/search'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { PersonSummary } from '../types/person'
import { inputClassName } from '../utils/formStyles'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

// Shared search-and-select UI, used by both AdminApprovePage (approving
// a new request) and AdminUsersPage (fixing a wrong person_id) -- avoids
// duplicating the same search-and-click logic in both places. Searches
// live as you type (debounced, no Search button) -- results render as a
// dropdown under the input, matching a standard autocomplete.
export default function PersonPicker({
  idToken,
  initialQuery,
  selected,
  onSelect,
}: {
  idToken: string
  initialQuery?: string
  selected: PersonSummary | null
  onSelect: (person: PersonSummary) => void
}) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<PersonSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // debounced's initial value equals `query`'s (no delay on mount), so
  // an initialQuery from the Request Access deep link still searches
  // automatically on mount -- this effect covers that case for free,
  // no separate mount-only effect needed.
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)

  useEffect(() => {
    const q = debouncedQuery.trim()
    let cancelled = false

    // Deferred a microtask so none of these setState calls fire
    // synchronously within the effect body itself
    // (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      if (cancelled) return
      if (q.length < MIN_QUERY_LENGTH) {
        setResults([])
        return
      }
      setSearching(true)
      setError(null)
      searchPersons(q, idToken)
        .then((r) => {
          if (!cancelled) setResults(r)
        })
        .catch(() => {
          if (!cancelled) setError('Search failed.')
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, idToken])

  function handleSelect(person: PersonSummary) {
    onSelect(person)
    // Closes the dropdown -- an empty box, ready for a different search,
    // reads more clearly than leaving the just-picked person's own name
    // sitting in the input.
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name..."
        className={inputClassName}
      />
      {searching && <p className="text-sm text-fe-ink/60 mt-1">Searching...</p>}
      {error && <p className="text-sm text-red-700 mt-1">{error}</p>}
      {results.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-fe-brown/20 rounded-sm shadow-md divide-y divide-fe-brown/10 max-h-48 overflow-y-auto">
          {results.map((person) => (
            <li key={person.person_id}>
              <button
                type="button"
                onClick={() => handleSelect(person)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-fe-bg"
              >
                {person.first_name} {person.last_name}
                {person.date_of_birth && (
                  <span className="text-fe-ink/60"> (b. {person.date_of_birth})</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <p className="text-sm text-fe-ink/80 mt-2">
          Selected:{' '}
          <strong>
            {selected.first_name} {selected.last_name}
          </strong>{' '}
          (person_id {selected.person_id})
        </p>
      )}
    </div>
  )
}
