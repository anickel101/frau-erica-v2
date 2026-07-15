import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb, seedFixtures } from '../testFixtures'
import { getPersonById } from './persons'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedFixtures(db)
})

describe('getPersonById', () => {
  test('returns undefined for an unknown person', () => {
    expect(getPersonById(db, 999)).toBeUndefined()
  })

  test('coerces null middle_name/suffix to empty string, matching the export script convention', () => {
    const person = getPersonById(db, 3)
    expect(person?.middle_name).toBe('')
    expect(person?.suffix).toBe('')
  })

  test('resolves the family this person is a partner in', () => {
    const person = getPersonById(db, 3) // Anna, partnered with Karl in family_id 1
    expect(person?.familyIdsAsPartner).toEqual([1])
  })

  test('resolves the family this person is a child in', () => {
    const person = getPersonById(db, 3) // Anna, child of Hans+Greta (family_id 2)
    expect(person?.familyIdAsChild).toBe(2)
  })

  test('familyIdAsChild resolves through a grandchild too', () => {
    const person = getPersonById(db, 7) // Lena, child of Anna+Karl (family_id 1)
    expect(person?.familyIdAsChild).toBe(1)
  })

  test('familyIdAsChild is null when the parent has no Families row of their own', () => {
    const person = getPersonById(db, 10) // Orphan, child of Wilhelm, who is unpaired
    expect(person?.familyIdAsChild).toBeNull()
  })
})
