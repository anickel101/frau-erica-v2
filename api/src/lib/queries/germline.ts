import type { Database } from 'sql.js'
import { PERSON_COLUMNS, toPersonSummary } from '../personHelpers'
import { inClause, queryAll, queryOne } from '../sqlHelpers'
import type { LinkedPersonSummary } from '../types'
import { resolveLinkedFamilyId } from './families'

// Every biological ancestor, walking biological_parent edges upward
// from personId as far as the data goes -- step_parent/adoptive_parent
// deliberately excluded (see schema/schema.sql's Relationships comment
// and app/CLAUDE.md's germline feature note: DNA-based only).
//
// UNION (not UNION ALL) is deliberate: SQLite's recursive CTE
// evaluation terminates once a candidate row repeats exactly, which
// makes this safe against a cyclic data error even though
// check_parent_birth_order already makes a real cycle unlikely.
export function getGermlineIds(db: Database, personId: number): number[] {
  const rows = queryAll<{ person_id: number }>(
    db,
    `WITH RECURSIVE ancestors(person_id) AS (
       SELECT r.person_id_1 FROM Relationships r
       WHERE r.person_id_2 = :startId AND r.relationship_type = 'biological_parent'
       UNION
       SELECT r.person_id_1 FROM Relationships r
       JOIN ancestors a ON r.person_id_2 = a.person_id
       WHERE r.relationship_type = 'biological_parent'
     )
     SELECT person_id FROM ancestors`,
    { ':startId': personId },
  )
  return rows.map((row) => row.person_id)
}

interface AncestorDepthRow {
  person_id: number
  depth: number
}

// Depth needs its own query, not a reuse of getGermlineIds -- tracking
// depth means two visits to the same person at different depths are no
// longer identical rows, so UNION's cycle-termination trick above no
// longer applies. UNION ALL + an explicit LIMIT is SQLite's own
// documented pattern for bounding a recursive CTE instead. 10,000 rows
// is far beyond anything a real tree of ~1,300 people could produce --
// a pure safety backstop, not a real limit.
function getAncestorDepths(db: Database, personId: number): AncestorDepthRow[] {
  return queryAll<AncestorDepthRow>(
    db,
    `WITH RECURSIVE ancestors(person_id, depth) AS (
       SELECT r.person_id_1, 1 FROM Relationships r
       WHERE r.person_id_2 = :startId AND r.relationship_type = 'biological_parent'
       UNION ALL
       SELECT r.person_id_1, a.depth + 1 FROM Relationships r
       JOIN ancestors a ON r.person_id_2 = a.person_id
       WHERE r.relationship_type = 'biological_parent'
       LIMIT 10000
     )
     SELECT person_id, MAX(depth) AS depth FROM ancestors GROUP BY person_id`,
    { ':startId': personId },
  )
}

interface CandidateRow {
  person_id: number
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  date_of_birth: string | null
  birth_year: number | null
}

// The single most-generations-back biological ancestor. Ties (more than
// one ancestor at the same maximum depth -- a normal outcome, since
// different branches of a tree can be documented to different depths)
// are broken by earliest known birth date, then lowest person_id if
// still tied -- both fully deterministic.
export function getFurthestAncestor(
  db: Database,
  personId: number,
): LinkedPersonSummary | null {
  const depths = getAncestorDepths(db, personId)
  if (depths.length === 0) return null

  const maxDepth = Math.max(...depths.map((d) => d.depth))
  const candidateIds = depths.filter((d) => d.depth === maxDepth).map((d) => d.person_id)

  const ids = inClause('id', candidateIds)
  const candidates = queryAll<CandidateRow>(
    db,
    `SELECT ${PERSON_COLUMNS} FROM Persons WHERE person_id IN (${ids.sql})`,
    ids.params,
  )

  candidates.sort((a, b) => {
    const dateA = a.date_of_birth ?? (a.birth_year ? `${a.birth_year}-01-01` : null)
    const dateB = b.date_of_birth ?? (b.birth_year ? `${b.birth_year}-01-01` : null)
    if (dateA !== dateB) {
      if (dateA === null) return 1
      if (dateB === null) return -1
      return dateA < dateB ? -1 : 1
    }
    return a.person_id - b.person_id
  })

  const winner = candidates[0]
  return {
    ...toPersonSummary(winner),
    linkedFamilyId: resolveLinkedFamilyId(db, winner.person_id),
  }
}

// This person's own immediate biological parents -- one hop, not the
// recursive germline walk. biological_parent only (unlike
// queries/persons.ts's getFamilyIdAsChild, which uses all three parent
// types and collapses straight to a family_id) -- there's no existing
// function anywhere that returns this list directly. Whatever's
// actually on record: 0, 1, or 2 ids, never assumed to be exactly 2.
export function getBiologicalParentIds(db: Database, personId: number): number[] {
  const rows = queryAll<{ person_id_1: number }>(
    db,
    `SELECT person_id_1 FROM Relationships
     WHERE person_id_2 = :childId AND relationship_type = 'biological_parent'`,
    { ':childId': personId },
  )
  return rows.map((row) => row.person_id_1)
}

// Like getFurthestAncestor, but for "the furthest known point on this
// parent's own line" rather than "the furthest ancestor of this
// person" -- the difference matters at the edge: if a parent has no
// further recorded ancestors of their own, getFurthestAncestor
// correctly returns null (they're not their own ancestor), but here
// the parent themselves IS the meaningful answer -- they're the
// furthest known point on this specific line, even though the word
// "ancestor" doesn't technically apply to them.
export function getFurthestAncestorInLine(
  db: Database,
  startPersonId: number,
): LinkedPersonSummary {
  const ancestor = getFurthestAncestor(db, startPersonId)
  if (ancestor) return ancestor

  const row = queryOne<CandidateRow>(
    db,
    `SELECT ${PERSON_COLUMNS} FROM Persons WHERE person_id = :id`,
    { ':id': startPersonId },
  )
  // startPersonId always comes from getBiologicalParentIds, i.e. always
  // a real person_id already known to exist.
  return {
    ...toPersonSummary(row as CandidateRow),
    linkedFamilyId: resolveLinkedFamilyId(db, startPersonId),
  }
}

export interface AncestralLine {
  parentId: number
  // Just the first name -- matches the agreed sidebar link text
  // exactly ("Furthest Ancestor (via Hans)"), not a full name.
  parentName: string
  furthestAncestor: LinkedPersonSummary
}

// One entry per immediate biological parent on record (0, 1, or 2 --
// never hardcoded to 2), each with the furthest known point on that
// parent's own line. The only function the handler calls directly --
// handler stays thin, matching api/CLAUDE.md's "Handler = thin, logic
// in lib/" convention.
export function getAncestralLines(db: Database, personId: number): AncestralLine[] {
  return getBiologicalParentIds(db, personId).map((parentId) => {
    const row = queryOne<{ first_name: string }>(
      db,
      'SELECT first_name FROM Persons WHERE person_id = :id',
      { ':id': parentId },
    )
    return {
      parentId,
      parentName: row?.first_name ?? '',
      furthestAncestor: getFurthestAncestorInLine(db, parentId),
    }
  })
}
