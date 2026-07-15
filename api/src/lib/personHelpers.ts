import type { Person, PersonSummary } from './types'

export function toPersonSummary(person: {
  person_id: number
  first_name: string
  last_name: string
  date_of_birth: string | null
}): PersonSummary {
  return {
    person_id: person.person_id,
    first_name: person.first_name,
    last_name: person.last_name,
    ...(person.date_of_birth ? { date_of_birth: person.date_of_birth } : {}),
  }
}

// Mirrors app/src/utils/personDisplay.ts's getFullName. Duplicated rather
// than shared because api/ and app/ are deliberately separate dependency
// trees (see the gated-content-architecture memory's repo-structure
// decision) -- keep in sync by hand if that function's logic changes.
export function getFullName(
  person: Pick<Person, 'first_name' | 'middle_name' | 'last_name' | 'suffix'>,
): string {
  const parts = [person.first_name, person.middle_name, person.last_name].filter(Boolean)
  return person.suffix ? `${parts.join(' ')} ${person.suffix}` : parts.join(' ')
}
