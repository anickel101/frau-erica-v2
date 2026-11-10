import { useEffect, useState } from 'react'
import SearchInput from './SearchInput'
import { searchPersons } from '../data-access/gated/search'
import { mockPersons } from '../data/mockPersons'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { Person } from '../types/person'
import { getFullName, matchesWords } from '../utils/personDisplay'
import { personLabel } from '../utils/tagSuggestions'

// Finding a person by name, for the admin tagging pages. Shared by
// TagPhotosPage and TagTextsPage, so a fix to one is a fix to both --
// this search has already been wrong once in a way that mattered.
//
// The query is the caller's state, not this component's: both pages
// fill the box from elsewhere (a name a caption mentions, an old-site
// tag) and clear it after a pick.
export default function PersonSearch({
  query,
  onQueryChange,
  onPick,
  exclude = [],
  placeholder = 'Search by name...',
}: {
  query: string
  onQueryChange: (query: string) => void
  onPick: (person: Person) => void
  // People already chosen, left out of the results.
  exclude?: number[]
  placeholder?: string
}) {
  const aliases = useAliasMatches(query)
  const personById = new Map(mockPersons.map((p) => [p.person_id, p]))

  // The record's own name, matched here instantly; then anyone the API
  // found under another name -- a married surname or the name they went
  // by -- once it answers. Nana is filed as Mary Allison Bigelow, and a
  // search for "Molly McMillan" used to find only her granddaughter, so
  // the granddaughter got five of Nana's links. Showing both, each with
  // dates and the name that matched, is what tells them apart.
  const local = query.trim()
    ? mockPersons.filter((p) => matchesWords(getFullName(p), query)).slice(0, 8)
    : []
  const localIds = new Set(local.map((p) => p.person_id))
  const byAlias = [...aliases]
    .filter(([id]) => !localIds.has(id))
    .flatMap(([id, alias]) => {
      const person = personById.get(id)
      return person ? [{ person, alias }] : []
    })
  const matches = [
    ...local.map((person) => ({ person, alias: undefined as string | undefined })),
    ...byAlias,
  ]
  const results = matches.filter(({ person }) => !exclude.includes(person.person_id))
  // Matches left out because they are already chosen. Said out loud when
  // they are all there is: "Nobody by that name" for someone who is
  // already on the list reads as though the archive has lost them.
  const alreadyChosen = matches.filter(({ person }) => exclude.includes(person.person_id))

  return (
    <>
      <SearchInput value={query} onChange={onQueryChange} placeholder={placeholder} />
      <ul className="mt-2 space-y-1">
        {results.map(({ person, alias }) => (
          <li key={person.person_id}>
            <button
              type="button"
              onClick={() => onPick(person)}
              className="w-full cursor-pointer rounded-sm px-2 py-1 text-left text-sm hover:bg-fe-brown hover:text-white"
            >
              {personLabel(person)}
              {alias && (
                <span className="block text-[11px] opacity-70">known as {alias}</span>
              )}
            </button>
          </li>
        ))}
        {query.trim() && results.length === 0 && (
          <li className="px-2 py-1 text-xs text-fe-ink/60">
            {alreadyChosen.length > 0
              ? `Already added: ${alreadyChosen.map(({ person }) => getFullName(person)).join(', ')}.`
              : 'Nobody by that name.'}
          </li>
        )}
      </ul>
    </>
  )
}

// Who the gated search found under a name other than their record's,
// keyed by person_id -> the name that matched. Married surnames come
// from spouse relationships, which stay behind the API rather than in
// the public persons.json; these pages are admin-only, so they may ask.
//
// A failed or slow search costs nothing: the instant local matches are
// already on screen, and these only ever add to them.
function useAliasMatches(query: string): Map<number, string> {
  const debounced = useDebouncedValue(query, 300)
  const [aliases, setAliases] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    const q = debounced.trim()
    let cancelled = false
    // Deferred a microtask so no setState fires synchronously in the
    // effect body (react-hooks/set-state-in-effect), as PersonPicker does.
    void Promise.resolve().then(() => {
      if (cancelled) return
      if (q.length < 2) {
        setAliases(new Map())
        return
      }
      searchPersons(q)
        .then((results) => {
          if (cancelled) return
          setAliases(
            new Map(
              results.flatMap((p) =>
                p.also_known_as ? [[p.person_id, p.also_known_as] as const] : [],
              ),
            ),
          )
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [debounced])

  // Stale answers for an old query would otherwise linger while a new
  // one is typed; only show them once the box has settled on them.
  return debounced === query ? aliases : new Map()
}
