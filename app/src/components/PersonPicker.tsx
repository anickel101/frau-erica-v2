import { useEffect, useState } from 'react'
import { PersonSummary, searchPersons } from '../data-access/gated/search'
import { inputClassName } from '../utils/formStyles'

// Shared search-and-select UI, used by both AdminApprovePage (approving
// a new request) and AdminUsersPage (fixing a wrong person_id) -- avoids
// duplicating the same search-and-click logic in both places.
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

  async function runSearch(q: string) {
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    setError(null)
    try {
      setResults(await searchPersons(q, idToken))
    } catch {
      setError('Search failed.')
    } finally {
      setSearching(false)
    }
  }

  // Auto-search once on mount if a name was passed in (the Request
  // Access email's deep link) -- the admin shouldn't have to retype what
  // the requester already told them.
  useEffect(() => {
    if (!initialQuery) return
    // Deferred a microtask so runSearch's own setState calls don't fire
    // synchronously within the effect body itself (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => runSearch(initialQuery))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally once, on mount
  }, [])

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => runSearch(query)}
          disabled={searching}
          className="px-3 py-2 border border-fe-brown/40 rounded-sm text-sm bg-white hover:bg-fe-bg disabled:opacity-50 shrink-0"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      {results.length > 0 && (
        <ul className="border border-fe-brown/20 rounded-sm divide-y divide-fe-brown/10 mb-2 max-h-48 overflow-y-auto">
          {results.map((person) => (
            <li key={person.person_id}>
              <button
                type="button"
                onClick={() => onSelect(person)}
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
        <p className="text-sm text-fe-ink/80">
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
