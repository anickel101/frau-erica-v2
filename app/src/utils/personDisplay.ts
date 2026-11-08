import { Person } from '../types/person'

// Structural, not Person: anything carrying the name fields will do,
// which lets the Family page's LinkedPersonSummary (no suffix on record)
// share this with the Index of Persons rather than joining the parts a
// second way.
type Nameable = Pick<Person, 'first_name' | 'last_name'> &
  Partial<Pick<Person, 'middle_name' | 'suffix'>>

export function getFullName(person: Nameable): string {
  const parts = [person.first_name, person.middle_name, person.last_name].filter(Boolean)
  return person.suffix ? `${parts.join(' ')} ${person.suffix}` : parts.join(' ')
}

// Every word typed appears somewhere in the name, in any order. A single
// substring of the whole name found nobody for "Mark Nickel": the record
// is Mark Mueller Nickel, and almost everyone here has a middle name.
// Same rule as api/src/lib/queries/search.ts's matchesWords.
export function matchesWords(name: string, query: string): boolean {
  const haystack = name.toLowerCase()
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every((word) => haystack.includes(word))
}

export function getGroupLetter(person: Person): string {
  const key = person.last_name || person.first_name
  return key ? key[0].toUpperCase() : '?'
}
