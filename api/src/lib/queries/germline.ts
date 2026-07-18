import type { Database } from 'sql.js'
import { PERSON_COLUMNS, toPersonSummary } from '../personHelpers'
import { inClause, queryAll } from '../sqlHelpers'
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
