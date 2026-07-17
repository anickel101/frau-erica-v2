import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb, seedFixtures } from '../testFixtures'
import { getAnniversaries } from './anniversaries'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedFixtures(db)
})

describe('getAnniversaries', () => {
  test('includes a birth event for every person with a date_of_birth', () => {
    const events = getAnniversaries(db)
    const births = events.filter((e) => e.type === 'birth')
    const anna = births.find((e) => e.personId === 3)
    expect(anna).toMatchObject({
      type: 'birth',
      date: '1950-05-10',
      personName: 'Anna Mueller',
      linkedFamilyId: 1, // partner in family 1, wins over child-of-family-2
    })
  })

  test('includes a death event only for persons with a date_of_death', () => {
    const events = getAnniversaries(db)
    const deaths = events.filter((e) => e.type === 'death')
    expect(deaths.map((e) => e.personId).sort()).toEqual([1, 5])

    const hans = deaths.find((e) => e.personId === 1)
    expect(hans).toMatchObject({
      type: 'death',
      date: '1995-01-01',
      personName: 'Hans Mueller',
      linkedFamilyId: 2, // Hans's partner family with Greta
    })
  })

  test('a birth/death event resolves linkedFamilyId via the child fallback when the person has no partner family', () => {
    const events = getAnniversaries(db)
    const lena = events.find((e) => e.type === 'birth' && e.personId === 7)
    expect(lena?.linkedFamilyId).toBe(1) // Lena, child of Anna+Karl
  })

  test('a marriage event resolves to the Families row matching that specific relationship pair, not just any partner family of person_id_1', () => {
    const events = getAnniversaries(db)
    const marriages = events.filter((e) => e.type === 'marriage')
    const klausAndWifeTwo = marriages.find((e) => e.personId === 13)
    expect(klausAndWifeTwo).toMatchObject({
      type: 'marriage',
      date: '1975-06-14',
      personName: 'Klaus Twice',
      spouseId: 15,
      spouseName: 'Wife Two',
      linkedFamilyId: 7, // NOT 6 (Klaus's other marriage)
    })
  })

  test('a marriage event with no matching Families row resolves linkedFamilyId: null', () => {
    const events = getAnniversaries(db)
    const wilhelmMarriage = events.find((e) => e.type === 'marriage' && e.personId === 9)
    expect(wilhelmMarriage).toMatchObject({
      spouseId: 12,
      spouseName: 'Frieda Standalone',
      linkedFamilyId: null,
    })
  })

  test('a person with parents on record but no Families row of their own resolves linkedFamilyId: null', () => {
    // Wilhelm (9) has no Families row of his own (fixture comment) --
    // his own birth event should not accidentally pick up a family via
    // some other path.
    const events = getAnniversaries(db)
    const wilhelmBirth = events.find((e) => e.type === 'birth' && e.personId === 9)
    expect(wilhelmBirth?.linkedFamilyId).toBeNull()
  })

  test('excludes persons with only a birth_year on record (no full date_of_birth)', () => {
    // YearOnly Standalone (16) has birth_year but no date_of_birth --
    // can't be placed on a specific day-of-month, so no event at all.
    const events = getAnniversaries(db)
    expect(events.some((e) => e.personId === 16)).toBe(false)
  })
})
