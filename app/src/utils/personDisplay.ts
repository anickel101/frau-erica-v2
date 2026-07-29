import { Person } from '../types/person'

export function getFullName(person: Person): string {
  const parts = [person.first_name, person.middle_name, person.last_name].filter(Boolean)
  return person.suffix ? `${parts.join(' ')} ${person.suffix}` : parts.join(' ')
}

export function getGroupLetter(person: Person): string {
  const key = person.last_name || person.first_name
  return key ? key[0].toUpperCase() : '?'
}
