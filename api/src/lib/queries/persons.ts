import type { Database } from 'sql.js'
import { PARENT_RELATIONSHIP_TYPES } from '../relationshipTypes'
import { queryAll, queryOne } from '../sqlHelpers'
import type { Person, PersonDetail } from '../types'

function getPersonRow(db: Database, personId: number): Person | undefined {
  return queryOne<Person>(
    db,
    `SELECT person_id, first_name, COALESCE(middle_name, '') AS middle_name,
            last_name, COALESCE(suffix, '') AS suffix,
            date_of_birth, birth_year, date_of_death, death_year
     FROM Persons WHERE person_id = :id`,
    { ':id': personId },
  )
}

// Every Families row where this person is a partner -- can be more than
// one (widowed then remarried, etc. -- see schema.sql's Families comment).
function getFamilyIdsAsPartner(db: Database, personId: number): number[] {
  const rows = queryAll<{ family_id: number }>(
    db,
    'SELECT family_id FROM Families WHERE person_id_1 = :id OR person_id_2 = :id',
    { ':id': personId },
  )
  return rows.map((r) => r.family_id)
}

// The Families row representing this person's own parents, if their
// parents happen to be paired in one. Picks the first match when there's
// ambiguity (e.g. parents on record but never in a shared Families row,
// or more than one candidate row) -- resolving that is a frontend/UX
// call, not a data one.
function getFamilyIdAsChild(db: Database, personId: number): number | null {
  const typeCols = PARENT_RELATIONSHIP_TYPES.map((_, i) => `:type${i}`).join(', ')
  const parentRows = queryAll<{ person_id_1: number }>(
    db,
    `SELECT person_id_1 FROM Relationships
     WHERE person_id_2 = :childId AND relationship_type IN (${typeCols})`,
    Object.fromEntries([
      [':childId', personId],
      ...PARENT_RELATIONSHIP_TYPES.map((t, i) => [`:type${i}`, t]),
    ]),
  )
  if (parentRows.length === 0) return null

  const parentIds = parentRows.map((r) => r.person_id_1)
  const parentCols = parentIds.map((_, i) => `:parent${i}`).join(', ')
  const family = queryOne<{ family_id: number }>(
    db,
    `SELECT family_id FROM Families
     WHERE person_id_1 IN (${parentCols}) OR person_id_2 IN (${parentCols})`,
    Object.fromEntries(parentIds.map((id, i) => [`:parent${i}`, id])),
  )
  return family?.family_id ?? null
}

export function getPersonById(db: Database, personId: number): PersonDetail | undefined {
  const person = getPersonRow(db, personId)
  if (!person) return undefined

  return {
    ...person,
    familyIdsAsPartner: getFamilyIdsAsPartner(db, personId),
    familyIdAsChild: getFamilyIdAsChild(db, personId),
  }
}
