import type { Database } from 'sql.js'
import { PERSON_COLUMNS } from '../personHelpers'
import { PARENT_RELATIONSHIP_TYPES } from '../relationshipTypes'
import { inClause, queryAll, queryOne } from '../sqlHelpers'
import type { Person, PersonDetail } from '../types'

function getPersonRow(db: Database, personId: number): Person | undefined {
  return queryOne<Person>(
    db,
    `SELECT ${PERSON_COLUMNS} FROM Persons WHERE person_id = :id`,
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
// parents happen to be paired in one. Picks the lowest family_id when
// there's ambiguity (e.g. parents on record but never in a shared
// Families row, or more than one candidate row) -- resolving that is a
// frontend/UX call, not a data one, but the choice needs to be
// deterministic rather than whatever order SQLite happens to return.
function getFamilyIdAsChild(db: Database, personId: number): number | null {
  const types = inClause('type', PARENT_RELATIONSHIP_TYPES)
  const parentRows = queryAll<{ person_id_1: number }>(
    db,
    `SELECT person_id_1 FROM Relationships
     WHERE person_id_2 = :childId AND relationship_type IN (${types.sql})`,
    { ':childId': personId, ...types.params },
  )
  if (parentRows.length === 0) return null

  const parentIds = parentRows.map((r) => r.person_id_1)
  const parents = inClause('parent', parentIds)
  const family = queryOne<{ family_id: number }>(
    db,
    `SELECT family_id FROM Families
     WHERE person_id_1 IN (${parents.sql}) OR person_id_2 IN (${parents.sql})
     ORDER BY family_id LIMIT 1`,
    parents.params,
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
