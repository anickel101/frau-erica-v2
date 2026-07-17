import type { Person, PersonSummary } from './types'

// Shared column list for a full Persons row -- queries/persons.ts's
// single-row lookup and queries/search.ts's full-table scan both select
// exactly this, previously kept as two independently hand-typed copies.
export const PERSON_COLUMNS = `person_id, first_name, COALESCE(middle_name, '') AS middle_name,
       last_name, COALESCE(suffix, '') AS suffix,
       date_of_birth, birth_year, date_of_death, death_year`

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
