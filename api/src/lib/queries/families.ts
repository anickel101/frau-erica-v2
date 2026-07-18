import type { Database } from 'sql.js'
import { toPersonSummary } from '../personHelpers'
import { getFamilyIdAsChild, getFamilyIdsAsPartner } from './persons'
import { PARENT_RELATIONSHIP_TYPES } from '../relationshipTypes'
import { inClause, queryAll, queryOne } from '../sqlHelpers'
import type { FamilyDetail, GallerySummary, LinkedPersonSummary } from '../types'

interface FamilyRow {
  family_id: number
  person_id_1: number | null
  person_id_2: number | null
  description: string | null
}

interface PersonSummaryRow {
  person_id: number
  first_name: string
  last_name: string
  date_of_birth: string | null
}

// Same resolution PersonDetail's familyIdsAsPartner/familyIdAsChild
// expose for a single person (see queries/persons.ts) -- reused here to
// embed each displayed person's own "family page" link directly in this
// response, so the frontend's PersonCard can link straight to
// /family/:id without a separate GET /persons/:id round trip per click.
// Exported -- queries/germline.ts's getFurthestAncestor is a second
// caller, resolving the furthest-back ancestor's own family link.
export function resolveLinkedFamilyId(db: Database, personId: number): number | null {
  return getFamilyIdsAsPartner(db, personId)[0] ?? getFamilyIdAsChild(db, personId)
}

// Bulk version of resolveLinkedFamilyId, for callers that need this for
// most/all of Persons at once (e.g. queries/anniversaries.ts) rather than
// a handful of people on one Family page -- calling resolveLinkedFamilyId
// once per person there would be 1,300+ individual queries. Two queries
// total instead, regardless of dataset size: one pass over Families for
// the partner case, one pass over Relationships+Families for the child
// fallback, same "partner wins over child" precedence as
// resolveLinkedFamilyId itself.
export function resolveLinkedFamilyIdsBulk(db: Database): Map<number, number> {
  // MIN() + GROUP BY, not a plain UNION ALL -- someone widowed/remarried
  // (schema.sql's own documented case) is a partner in more than one
  // Families row, and UNION ALL's result order across the two branches
  // isn't guaranteed, so picking "the last row processed" would be
  // nondeterministic. MIN(family_id) matches resolveLinkedFamilyId's own
  // effective behavior (its single, ORDER-BY-free query happens to
  // return family_id ascending on a plain table scan).
  const partnerRows = queryAll<{ person_id: number; family_id: number }>(
    db,
    `SELECT person_id, MIN(family_id) AS family_id FROM (
       SELECT person_id_1 AS person_id, family_id FROM Families WHERE person_id_1 IS NOT NULL
       UNION ALL
       SELECT person_id_2 AS person_id, family_id FROM Families WHERE person_id_2 IS NOT NULL
     ) GROUP BY person_id`,
  )

  const types = inClause('type', PARENT_RELATIONSHIP_TYPES)
  const childRows = queryAll<{ person_id: number; family_id: number }>(
    db,
    `SELECT r.person_id_2 AS person_id, MIN(f.family_id) AS family_id
     FROM Relationships r
     JOIN Families f ON f.person_id_1 = r.person_id_1 OR f.person_id_2 = r.person_id_1
     WHERE r.relationship_type IN (${types.sql})
     GROUP BY r.person_id_2`,
    types.params,
  )

  const map = new Map<number, number>()
  for (const row of childRows) map.set(row.person_id, row.family_id)
  for (const row of partnerRows) map.set(row.person_id, row.family_id)
  return map
}

function toLinkedPersonSummary(db: Database, row: PersonSummaryRow): LinkedPersonSummary {
  return {
    ...toPersonSummary(row),
    linkedFamilyId: resolveLinkedFamilyId(db, row.person_id),
  }
}

function getPersonSummary(db: Database, personId: number): LinkedPersonSummary | null {
  const row = queryOne<PersonSummaryRow>(
    db,
    'SELECT person_id, first_name, last_name, date_of_birth FROM Persons WHERE person_id = :id',
    { ':id': personId },
  )
  return row ? toLinkedPersonSummary(db, row) : null
}

// A person's own parents -- "grandparents" from the featured couple's
// perspective. Not deduped across biological/step/adoptive on purpose: a
// person can have e.g. one biological and one step parent on record
// simultaneously, and both belong on the page.
function getParents(db: Database, personId: number): LinkedPersonSummary[] {
  const types = inClause('type', PARENT_RELATIONSHIP_TYPES)
  const rows = queryAll<PersonSummaryRow>(
    db,
    `SELECT p.person_id, p.first_name, p.last_name, p.date_of_birth
     FROM Relationships r
     JOIN Persons p ON p.person_id = r.person_id_1
     WHERE r.person_id_2 = :childId AND r.relationship_type IN (${types.sql})`,
    { ':childId': personId, ...types.params },
  )
  return rows.map((row) => toLinkedPersonSummary(db, row))
}

// Children of this Families pairing -- anyone whose parent (per
// Relationships) is person_id_1 or person_id_2, per schema.sql's own
// documented convention of deriving children rather than storing them
// redundantly on Families. DISTINCT because both parents typically have
// their own Relationships row pointing at the same child.
function getChildren(db: Database, parentIds: number[]): LinkedPersonSummary[] {
  if (parentIds.length === 0) return []
  const parents = inClause('parent', parentIds)
  const types = inClause('type', PARENT_RELATIONSHIP_TYPES)
  const rows = queryAll<PersonSummaryRow>(
    db,
    `SELECT DISTINCT p.person_id, p.first_name, p.last_name, p.date_of_birth
     FROM Relationships r
     JOIN Persons p ON p.person_id = r.person_id_2
     WHERE r.person_id_1 IN (${parents.sql})
       AND r.relationship_type IN (${types.sql})`,
    { ...parents.params, ...types.params },
  )
  return rows.map((row) => toLinkedPersonSummary(db, row))
}

// Galleries linked to either half of the featured couple. schema.sql's
// GalleryLinks.family_id column exists but is never populated in
// practice (confirmed against the real DB -- same situation as
// ImageLinks.family_id vs. Families.image_id, fixed earlier for the
// header image), so this resolves through person_id instead. Filtered
// to galleries with at least one published photo, matching the same
// rule app/scripts/export-data.ts already applies when building the
// public galleries.json -- otherwise this could link to a gallery page
// that doesn't actually exist in the public dataset.
function getLinkedGalleries(db: Database, personIds: number[]): GallerySummary[] {
  if (personIds.length === 0) return []
  const people = inClause('person', personIds)
  return queryAll<GallerySummary>(
    db,
    `SELECT DISTINCT g.gallery_id, g.name
     FROM GalleryLinks gl
     JOIN Galleries g ON g.gallery_id = gl.gallery_id
     WHERE gl.person_id IN (${people.sql})
       AND EXISTS (
         SELECT 1 FROM GalleryImages gi
         JOIN Images i ON i.image_id = gi.image_id
         WHERE gi.gallery_id = g.gallery_id AND i.is_published = 1
       )`,
    people.params,
  )
}

// The featured couple's own marriage status, if their spouse
// Relationships row exists. No existing query looks up "given this
// known pair, find their Relationships row" -- queries/anniversaries.ts's
// getMarriages runs the opposite direction (Relationships -> Families)
// and doesn't select status.
function getCoupleStatus(
  db: Database,
  personId1: number,
  personId2: number,
): string | null {
  const row = queryOne<{ status: string | null }>(
    db,
    `SELECT status FROM Relationships
     WHERE relationship_type = 'spouse'
       AND ((person_id_1 = :p1 AND person_id_2 = :p2) OR (person_id_1 = :p2 AND person_id_2 = :p1))`,
    { ':p1': personId1, ':p2': personId2 },
  )
  return row?.status ?? null
}

// The other family_id this person partners in, besides currentFamilyId
// (widowed/remarried, etc.) -- getFamilyIdsAsPartner already returns
// every family a person partners in, so this just filters out the
// current one. MIN() as the tiebreak for 3+ total marriages matches the
// precedent already established elsewhere in this file
// (resolveLinkedFamilyIdsBulk's MIN(family_id)) -- only one "other"
// family ever surfaces, matching the original site's single-triangle
// design rather than a list of every alternate.
function getOtherFamilyId(
  db: Database,
  personId: number,
  currentFamilyId: number,
): number | null {
  const others = getFamilyIdsAsPartner(db, personId).filter(
    (id) => id !== currentFamilyId,
  )
  return others.length > 0 ? Math.min(...others) : null
}

export function getFamilyById(db: Database, familyId: number): FamilyDetail | undefined {
  const family = queryOne<FamilyRow>(
    db,
    'SELECT family_id, person_id_1, person_id_2, description FROM Families WHERE family_id = :id',
    { ':id': familyId },
  )
  if (!family) return undefined

  const person1 =
    family.person_id_1 !== null ? getPersonSummary(db, family.person_id_1) : null
  const person2 =
    family.person_id_2 !== null ? getPersonSummary(db, family.person_id_2) : null

  // otherFamilyId/coupleStatus are only meaningful for the featured
  // couple, not grandparents/children -- computed here rather than in
  // toLinkedPersonSummary, which has no notion of "the current family."
  if (person1 && family.person_id_1 !== null) {
    person1.otherFamilyId = getOtherFamilyId(db, family.person_id_1, family.family_id)
  }
  if (person2 && family.person_id_2 !== null) {
    person2.otherFamilyId = getOtherFamilyId(db, family.person_id_2, family.family_id)
  }
  const coupleStatus =
    family.person_id_1 !== null && family.person_id_2 !== null
      ? getCoupleStatus(db, family.person_id_1, family.person_id_2)
      : null

  // Header image is linked via ImageLinks.family_id, not Families.
  // image_id -- confirmed against the real DB: Families.image_id is
  // NULL on all 870 rows, while ImageLinks has a published image for
  // 857 of them. schema.sql documents ImageLinks as the many-to-many
  // connector between Images and Persons/Families/Documents; every
  // family with a link has exactly one (confirmed), so no ordering
  // beyond that is needed. Raw filename, not a resolved URL -- matches
  // schema.sql's Images.url comment ("the website builds the actual
  // link at display time"), same convention app/'s existing Documents/
  // Galleries data-access layer already follows via resolveImageUrl().
  const headerImage = queryOne<{ url: string }>(
    db,
    `SELECT i.url FROM ImageLinks il
     JOIN Images i ON i.image_id = il.image_id
     WHERE il.family_id = :familyId AND i.is_published = 1`,
    { ':familyId': familyId },
  )

  // Also just "the couple" -- reused for getLinkedGalleries below, since
  // it's the same set of people getChildren already needed as parents.
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
    galleries: getLinkedGalleries(db, parentIds),
    coupleStatus,
  }
}
