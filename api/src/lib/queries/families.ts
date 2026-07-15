import type { Database } from 'sql.js'
import { toPersonSummary } from '../personHelpers'
import { PARENT_RELATIONSHIP_TYPES } from '../relationshipTypes'
import { queryAll, queryOne } from '../sqlHelpers'
import type { FamilyDetail, PersonSummary } from '../types'

interface FamilyRow {
  family_id: number
  person_id_1: number | null
  person_id_2: number | null
  description: string | null
  image_id: number | null
}

interface PersonSummaryRow {
  person_id: number
  first_name: string
  last_name: string
  date_of_birth: string | null
}

function getPersonSummary(db: Database, personId: number): PersonSummary | null {
  const row = queryOne<PersonSummaryRow>(
    db,
    'SELECT person_id, first_name, last_name, date_of_birth FROM Persons WHERE person_id = :id',
    { ':id': personId },
  )
  return row ? toPersonSummary(row) : null
}

// A person's own parents -- "grandparents" from the featured couple's
// perspective. Not deduped across biological/step/adoptive on purpose: a
// person can have e.g. one biological and one step parent on record
// simultaneously, and both belong on the page.
function getParents(db: Database, personId: number): PersonSummary[] {
  const typeCols = PARENT_RELATIONSHIP_TYPES.map((_, i) => `:type${i}`).join(', ')
  const rows = queryAll<PersonSummaryRow>(
    db,
    `SELECT p.person_id, p.first_name, p.last_name, p.date_of_birth
     FROM Relationships r
     JOIN Persons p ON p.person_id = r.person_id_1
     WHERE r.person_id_2 = :childId AND r.relationship_type IN (${typeCols})`,
    Object.fromEntries([
      [':childId', personId],
      ...PARENT_RELATIONSHIP_TYPES.map((t, i) => [`:type${i}`, t]),
    ]),
  )
  return rows.map(toPersonSummary)
}

// Children of this Families pairing -- anyone whose parent (per
// Relationships) is person_id_1 or person_id_2, per schema.sql's own
// documented convention of deriving children rather than storing them
// redundantly on Families. DISTINCT because both parents typically have
// their own Relationships row pointing at the same child.
function getChildren(db: Database, parentIds: number[]): PersonSummary[] {
  if (parentIds.length === 0) return []
  const parentCols = parentIds.map((_, i) => `:parent${i}`).join(', ')
  const typeCols = PARENT_RELATIONSHIP_TYPES.map((_, i) => `:type${i}`).join(', ')
  const rows = queryAll<PersonSummaryRow>(
    db,
    `SELECT DISTINCT p.person_id, p.first_name, p.last_name, p.date_of_birth
     FROM Relationships r
     JOIN Persons p ON p.person_id = r.person_id_2
     WHERE r.person_id_1 IN (${parentCols})
       AND r.relationship_type IN (${typeCols})`,
    Object.fromEntries([
      ...parentIds.map((id, i) => [`:parent${i}`, id]),
      ...PARENT_RELATIONSHIP_TYPES.map((t, i) => [`:type${i}`, t]),
    ]),
  )
  return rows.map(toPersonSummary)
}

export function getFamilyById(db: Database, familyId: number): FamilyDetail | undefined {
  const family = queryOne<FamilyRow>(
    db,
    'SELECT family_id, person_id_1, person_id_2, description, image_id FROM Families WHERE family_id = :id',
    { ':id': familyId },
  )
  if (!family) return undefined

  const person1 =
    family.person_id_1 !== null ? getPersonSummary(db, family.person_id_1) : null
  const person2 =
    family.person_id_2 !== null ? getPersonSummary(db, family.person_id_2) : null

  // Raw filename, not a resolved URL -- matches schema.sql's Images.url
  // comment ("the website builds the actual link at display time"), same
  // convention app/'s existing Documents/Galleries data-access layer
  // already follows via resolveImageUrl().
  const headerImage = family.image_id
    ? queryOne<{ url: string }>(db, 'SELECT url FROM Images WHERE image_id = :id', {
        ':id': family.image_id,
      })
    : undefined

  const parentIds = [family.person_id_1, family.person_id_2].filter(
    (id): id is number => id !== null,
  )

  return {
    family_id: family.family_id,
    person_1: person1,
    person_2: person2,
    description: family.description,
    header_image_url: headerImage?.url ?? null,
    grandparents_1: family.person_id_1 !== null ? getParents(db, family.person_id_1) : [],
    grandparents_2: family.person_id_2 !== null ? getParents(db, family.person_id_2) : [],
    children: getChildren(db, parentIds),
  }
}
