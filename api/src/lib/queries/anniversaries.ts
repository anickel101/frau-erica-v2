import type { Database } from 'sql.js'
import { getFullName, PERSON_COLUMNS } from '../personHelpers'
import { queryAll } from '../sqlHelpers'
import type { AnniversaryEvent } from '../types'
import { resolveLinkedFamilyIdsBulk } from './families'

interface PersonDateRow {
  person_id: number
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  date_of_birth: string | null
  date_of_death: string | null
}

interface MarriageRow {
  start_date: string
  person_id_1: number
  first_name_1: string
  middle_name_1: string
  last_name_1: string
  suffix_1: string
  person_id_2: number
  first_name_2: string
  middle_name_2: string
  last_name_2: string
  suffix_2: string
  family_id: number | null
}

function getBirths(db: Database, familyLinks: Map<number, number>): AnniversaryEvent[] {
  const rows = queryAll<PersonDateRow>(
    db,
    `SELECT ${PERSON_COLUMNS} FROM Persons WHERE date_of_birth IS NOT NULL`,
  )
  return rows.map((row) => ({
    type: 'birth',
    date: row.date_of_birth as string,
    personId: row.person_id,
    personName: getFullName(row),
    linkedFamilyId: familyLinks.get(row.person_id) ?? null,
  }))
}

function getDeaths(db: Database, familyLinks: Map<number, number>): AnniversaryEvent[] {
  const rows = queryAll<PersonDateRow>(
    db,
    `SELECT ${PERSON_COLUMNS} FROM Persons WHERE date_of_death IS NOT NULL`,
  )
  return rows.map((row) => ({
    type: 'death',
    date: row.date_of_death as string,
    personId: row.person_id,
    personName: getFullName(row),
    linkedFamilyId: familyLinks.get(row.person_id) ?? null,
  }))
}

// Marriage events resolve their own linkedFamilyId directly via a LEFT
// JOIN on the specific relationship pair, rather than reusing
// resolveLinkedFamilyIdsBulk's per-person map -- a person can appear as
// a partner in more than one Families row (widowed/remarried, per
// schema.sql's own comment), and the per-person map only knows "a"
// family for them, not necessarily the one this particular marriage
// row is about.
function getMarriages(db: Database): AnniversaryEvent[] {
  const rows = queryAll<MarriageRow>(
    db,
    `SELECT r.start_date,
            p1.person_id AS person_id_1, p1.first_name AS first_name_1,
            COALESCE(p1.middle_name, '') AS middle_name_1, p1.last_name AS last_name_1,
            COALESCE(p1.suffix, '') AS suffix_1,
            p2.person_id AS person_id_2, p2.first_name AS first_name_2,
            COALESCE(p2.middle_name, '') AS middle_name_2, p2.last_name AS last_name_2,
            COALESCE(p2.suffix, '') AS suffix_2,
            f.family_id
     FROM Relationships r
     JOIN Persons p1 ON p1.person_id = r.person_id_1
     JOIN Persons p2 ON p2.person_id = r.person_id_2
     LEFT JOIN Families f
       ON (f.person_id_1 = r.person_id_1 AND f.person_id_2 = r.person_id_2)
       OR (f.person_id_1 = r.person_id_2 AND f.person_id_2 = r.person_id_1)
     WHERE r.relationship_type = 'spouse' AND r.start_date IS NOT NULL`,
  )
  return rows.map((row) => ({
    type: 'marriage',
    date: row.start_date,
    personId: row.person_id_1,
    personName: getFullName({
      first_name: row.first_name_1,
      middle_name: row.middle_name_1,
      last_name: row.last_name_1,
      suffix: row.suffix_1,
    }),
    linkedFamilyId: row.family_id,
    spouseId: row.person_id_2,
    spouseName: getFullName({
      first_name: row.first_name_2,
      middle_name: row.middle_name_2,
      last_name: row.last_name_2,
      suffix: row.suffix_2,
    }),
  }))
}

export function getAnniversaries(db: Database): AnniversaryEvent[] {
  const familyLinks = resolveLinkedFamilyIdsBulk(db)
  return [
    ...getBirths(db, familyLinks),
    ...getDeaths(db, familyLinks),
    ...getMarriages(db),
  ]
}
