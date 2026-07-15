import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb, seedFixtures } from '../testFixtures'
import { getFamilyById } from './families'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedFixtures(db)
})

describe('getFamilyById', () => {
  test('returns undefined for an unknown family', () => {
    expect(getFamilyById(db, 999)).toBeUndefined()
  })

  test('resolves the couple, grandparents on both sides, and children', () => {
    const family = getFamilyById(db, 1)

    expect(family?.person_1).toEqual({
      person_id: 3,
      first_name: 'Anna',
      last_name: 'Mueller',
      date_of_birth: '1950-05-10',
    })
    expect(family?.person_2).toEqual({
      person_id: 4,
      first_name: 'Karl',
      last_name: 'Schmidt',
      date_of_birth: '1949-11-02',
    })

    expect(family?.grandparents_1.map((p) => p.person_id).sort()).toEqual([1, 2])
    expect(family?.grandparents_2.map((p) => p.person_id).sort()).toEqual([5, 6])

    expect(family?.children.map((p) => p.person_id).sort()).toEqual([7, 8])
  })

  test('resolves header_image_url to the raw filename, not a full URL', () => {
    const family = getFamilyById(db, 1)
    expect(family?.header_image_url).toBe('family1.jpg')
  })

  test('handles a family with no header image', () => {
    const family = getFamilyById(db, 2)
    expect(family?.header_image_url).toBeNull()
  })

  test('handles a single-parent family (nullable person_id_2)', () => {
    const family = getFamilyById(db, 4)
    expect(family?.person_1?.person_id).toBe(1)
    expect(family?.person_2).toBeNull()
    expect(family?.grandparents_2).toEqual([])
  })
})
