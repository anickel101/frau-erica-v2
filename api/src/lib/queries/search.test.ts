import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb, seedFixtures } from '../testFixtures'
import { searchPersons } from './search'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedFixtures(db)
})

describe('searchPersons', () => {
  test('matches by last name, case-insensitively', () => {
    const results = searchPersons(db, 'mueller')
    expect(results.map((p) => p.person_id).sort()).toEqual([1, 2, 3])
  })

  test('matches by first name', () => {
    const results = searchPersons(db, 'Karl')
    expect(results.map((p) => p.person_id)).toEqual([4])
  })

  test('matches by full-name substring spanning first and last name', () => {
    // Mirrors PersonsPage.tsx's getFullName(p).includes(q) behavior --
    // "anna mueller" isn't a single column value anywhere.
    const results = searchPersons(db, 'anna mueller')
    expect(results.map((p) => p.person_id)).toEqual([3])
  })

  test('returns an empty array for no matches', () => {
    expect(searchPersons(db, 'Nonexistent')).toEqual([])
  })
})
