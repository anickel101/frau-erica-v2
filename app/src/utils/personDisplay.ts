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

export function getGroupLetter(person: Person): string {
  const key = person.last_name || person.first_name
  return key ? key[0].toUpperCase() : '?'
}
