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
  test('one entry per known biological parent, each with the furthest point on that line', () => {
    const lines = getAncestralLines(db, 7) // Lena
    expect(lines).toHaveLength(2)

    const viaAnna = lines.find((l) => l.parentId === 3)
    expect(viaAnna?.parentName).toBe('Anna')
    expect(viaAnna?.furthestAncestor).toMatchObject({ person_id: 1, first_name: 'Hans' })

    const viaKarl = lines.find((l) => l.parentId === 4)
    expect(viaKarl?.parentName).toBe('Karl')
    expect(viaKarl?.furthestAncestor).toMatchObject({ person_id: 5, first_name: 'Otto' })
  })

  test('a single entry when only one parent is on record', () => {
    const lines = getAncestralLines(db, 10) // Orphan
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      parentId: 9,
      parentName: 'Wilhelm',
      furthestAncestor: { person_id: 9, first_name: 'Wilhelm' },
    })
  })

  test('an empty array when no parents are on record', () => {
    expect(getAncestralLines(db, 1)).toEqual([]) // Hans
  })
})
