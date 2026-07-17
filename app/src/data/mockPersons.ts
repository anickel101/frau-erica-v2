import raw from './generated/persons.json'
import type { Person } from '../types/person'

function sortKey(person: Person): string {
  return (person.last_name || person.first_name).toLowerCase()
}

export const mockPersons: Person[] = (raw as Person[]).slice().sort((a, b) => {
  const key = sortKey(a).localeCompare(sortKey(b))
  return key !== 0 ? key : a.first_name.localeCompare(b.first_name)
})
