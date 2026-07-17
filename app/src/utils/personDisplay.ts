import { formatDate } from './dateDisplay'
import { Person } from '../types/person'

export function getFullName(person: Person): string {
  const parts = [person.first_name, person.middle_name, person.last_name].filter(Boolean)
  return person.suffix ? `${parts.join(' ')} ${person.suffix}` : parts.join(' ')
}

export function getGroupLetter(person: Person): string {
  const key = person.last_name || person.first_name
  return key ? key[0].toUpperCase() : '?'
}

export function getBirthLabel(person: Person): string {
  if (person.date_of_birth) return formatDate(person.date_of_birth)
  if (person.birth_year) return String(person.birth_year)
  return ' '
}

export function getDeathLabel(person: Person): string {
  if (person.date_of_death) return formatDate(person.date_of_death)
  if (person.death_year) return String(person.death_year)
  return ' '
}
