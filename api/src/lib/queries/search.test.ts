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

  test('matches first and last name across a middle name', () => {
    db.run("UPDATE Persons SET middle_name = 'Maria' WHERE person_id = 3")
    expect(searchPersons(db, 'anna mueller').map((p) => p.person_id)).toEqual([3])
  })

  test('matches a preferred first name, and says which name matched', () => {
    db.run("UPDATE Persons SET preferred_first_name = 'Annie' WHERE person_id = 3")
    expect(searchPersons(db, 'annie mueller')).toEqual([
      expect.objectContaining({ person_id: 3, also_known_as: 'Annie Mueller' }),
    ])
  })

  test("matches a married name from a spouse's surname", () => {
    // Wife Two (15) married Klaus Twice (13); her record keeps "Two".
    const results = searchPersons(db, 'wife twice')
    expect(results).toEqual([
      expect.objectContaining({ person_id: 15, also_known_as: 'Wife Twice' }),
    ])
  })

  test('a match on the record name carries no also_known_as', () => {
    const [anna] = searchPersons(db, 'anna mueller')
    expect(anna).not.toHaveProperty('also_known_as')
  })

  test('never puts preferred_first_name on a search result', () => {
    db.run("UPDATE Persons SET preferred_first_name = 'Annie' WHERE person_id = 3")
    const [anna] = searchPersons(db, 'anna mueller')
    expect(anna).not.toHaveProperty('preferred_first_name')
  })

  test('returns an empty array for no matches', () => {
    expect(searchPersons(db, 'Nonexistent')).toEqual([])
  })
})
