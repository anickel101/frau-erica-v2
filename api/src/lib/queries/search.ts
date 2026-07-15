import type { Database } from 'sql.js'
import { getFullName, toPersonSummary } from '../personHelpers'
import { queryAll } from '../sqlHelpers'
import type { Person, PersonSummary } from '../types'

// Mirrors app/src/pages/PersonsPage.tsx's current client-side filter
// (getFullName(p).toLowerCase().includes(q)) exactly, including matches
// that span first and last name (e.g. "anna mueller"), which no single
// column LIKE could narrow to -- so this fetches every row and filters
// in JS rather than pre-narrowing in SQL. Fine at this data size
// (~1,300 people).
export function searchPersons(db: Database, query: string): PersonSummary[] {
  const rows = queryAll<Person>(
    db,
    `SELECT person_id, first_name, COALESCE(middle_name, '') AS middle_name,
            last_name, COALESCE(suffix, '') AS suffix,
            date_of_birth, birth_year, date_of_death, death_year
     FROM Persons`,
  )

  const needle = query.trim().toLowerCase()
  return rows
    .filter((p) => getFullName(p).toLowerCase().includes(needle))
    .map(toPersonSummary)
}
