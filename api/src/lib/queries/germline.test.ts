import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb, seedFixtures } from '../testFixtures'
import {
  getAncestralLines,
  getBiologicalParentIds,
  getFurthestAncestor,
  getFurthestAncestorInLine,
  getGermlineIds,
} from './germline'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedFixtures(db)
})

describe('getGermlineIds', () => {
  test('walks multiple generations back through both parents', () => {
    // Lena (7) -> Anna(3)+Karl(4) -> Hans(1)+Greta(2) / Otto(5)+Ida(6)
    const ids = getGermlineIds(db, 7)
    expect(ids.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
  })

  test('excludes step-parents -- biological_parent only', () => {
    const ids = getGermlineIds(db, 7)
    expect(ids).not.toContain(17) // StepDad Guy
  })

  test('returns an empty array for someone with no recorded parents', () => {
    expect(getGermlineIds(db, 1)).toEqual([]) // Hans
  })

  test('terminates correctly for a single-generation case', () => {
    expect(getGermlineIds(db, 3).sort((a, b) => a - b)).toEqual([1, 2]) // Anna
  })
})

describe('getFurthestAncestor', () => {
  test('picks the earliest-born ancestor among those at the maximum depth', () => {
    // Lena's max depth (2) candidates: Hans(1920-03-01), Greta(1922-07-14),
    // Otto(1918-01-01), Ida(1921-09-30) -- Otto is earliest.
    const result = getFurthestAncestor(db, 7)
    expect(result).toMatchObject({
      person_id: 5,
      first_name: 'Otto',
      last_name: 'Schmidt',
      linkedFamilyId: 3, // Otto + Ida's family
    })
  })

  test('resolves a single-generation case correctly', () => {
    // Anna's parents: Hans(1920-03-01) vs Greta(1922-07-14) -- Hans is earlier.
    const result = getFurthestAncestor(db, 3)
    expect(result).toMatchObject({
      person_id: 1,
      first_name: 'Hans',
      last_name: 'Mueller',
      linkedFamilyId: 2, // Hans + Greta's family
    })
  })

  test('returns null for someone with no recorded parents', () => {
    expect(getFurthestAncestor(db, 1)).toBeNull() // Hans
  })
})

describe('getBiologicalParentIds', () => {
  test('returns both parents when both are on record', () => {
    expect(getBiologicalParentIds(db, 3).sort()).toEqual([1, 2]) // Anna -> Hans, Greta
  })

  test('returns a single parent when only one is on record', () => {
    expect(getBiologicalParentIds(db, 10)).toEqual([9]) // Orphan -> Wilhelm only
  })

  test('returns an empty array for someone with no recorded parents', () => {
    expect(getBiologicalParentIds(db, 1)).toEqual([]) // Hans
  })
})

describe('getFurthestAncestorInLine', () => {
  test('falls back to the starting person when they have no recorded parents', () => {
    // Hans (1) has no recorded parents -- getFurthestAncestor(db, 1)
    // alone returns null (proven above), but here Hans himself is the
    // furthest known point on his own line.
    const result = getFurthestAncestorInLine(db, 1)
    expect(result).toMatchObject({
      person_id: 1,
      first_name: 'Hans',
      last_name: 'Mueller',
      linkedFamilyId: 2,
    })
  })

  test('resolves the same way getFurthestAncestor does when a real ancestor exists', () => {
    const result = getFurthestAncestorInLine(db, 4) // Karl
    expect(result).toMatchObject({
      person_id: 5,
      first_name: 'Otto',
      last_name: 'Schmidt',
    })
  })
})

describe('getAncestralLines', () => {
  // Traced at the GRANDparent generation, so Lena's two parents (Anna
  // and Karl) yield four lines, one per grandparent -- Opa's review
  // asked for the grandparent generation rather than the two links that
  // run through people already visible on his own family page.
  test('one entry per known biological grandparent', () => {
    const lines = getAncestralLines(db, 7) // Lena
    expect(lines.map((l) => l.viaId).sort()).toEqual([1, 2, 5, 6])

    const viaHans = lines.find((l) => l.viaId === 1)
    expect(viaHans?.viaName).toBe('Hans')
    // Hans has no recorded parents of his own, so his line ends at him.
    expect(viaHans?.furthestAncestor).toMatchObject({ person_id: 1, first_name: 'Hans' })

    const viaOtto = lines.find((l) => l.viaId === 5)
    expect(viaOtto?.viaName).toBe('Otto')
    expect(viaOtto?.furthestAncestor).toMatchObject({ person_id: 5, first_name: 'Otto' })
  })

  // A parent with no parents of their own must not drop that half of
  // the tree -- the line falls back to the parent themselves.
  test('falls back to the parent when no grandparents are on record', () => {
    const lines = getAncestralLines(db, 3) // Anna: parents Hans + Greta, neither has parents
    expect(lines.map((l) => l.viaId).sort()).toEqual([1, 2])
  })

  test('a single entry when only one parent is on record', () => {
    const lines = getAncestralLines(db, 10) // Orphan
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      viaId: 9,
      viaName: 'Wilhelm',
      furthestAncestor: { person_id: 9, first_name: 'Wilhelm' },
    })
  })

  test('an empty array when no parents are on record', () => {
    expect(getAncestralLines(db, 1)).toEqual([]) // Hans
  })
})
