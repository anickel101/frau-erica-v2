import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb } from '../testFixtures'
import { GENRES, getEditableText, listEditableTexts } from './textEditTargets'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  for (const [id, first] of [
    [21, 'Joel'],
    [108, 'Nana'],
    [500, 'Fieks'],
  ] as const) {
    db.run(`INSERT INTO Persons (person_id, first_name, last_name) VALUES (?, ?, 'X')`, [
      id,
      first,
    ])
  }
  db.run(
    `INSERT INTO Documents (document_id, title, genre, is_published, language)
     VALUES (1, 'Frau Erica', 'Literary', 1, 'en'),
            (2, 'Frau Erica (German)', 'Literary', 1, 'de'),
            (3, 'Unpublished', 'Other', 0, 'en'),
            (4, 'Chicago', 'Memoir', 1, 'en')`,
  )
  db.run('UPDATE Documents SET parallel_of = 1 WHERE document_id = 2')
  db.run(
    `INSERT INTO DocumentLinks (document_id, person_id)
     VALUES (1, 21), (2, 108), (2, 21), (3, 500)`,
  )
})

describe('listEditableTexts', () => {
  test('lists published works only, not German halves or unpublished texts', () => {
    expect(listEditableTexts(db).map((t) => t.document_id)).toEqual([1, 4])
  })

  // 65 of the archive's links sit on a German half. Reading the entry
  // point alone would show those works as linked to nobody.
  test('gathers links from both halves of a pair, once each', () => {
    const [frauErica, chicago] = listEditableTexts(db)
    expect(frauErica.person_ids).toEqual([21, 108])
    expect(chicago.person_ids).toEqual([])
  })
})

describe('getEditableText', () => {
  test('returns a published work', () => {
    expect(getEditableText(db, 1)?.title).toBe('Frau Erica')
  })

  test.each([
    [2, 'a German half'],
    [3, 'an unpublished text'],
    [999, 'an id nobody has'],
  ])('refuses %i, %s', (id) => {
    expect(getEditableText(db, id)).toBeNull()
  })
})

// A genre this file accepts and the archive refuses would only fail when
// the edits are applied, weeks after they were made.
test("GENRES matches the schema's CHECK constraint exactly", () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const schema = readFileSync(path.join(here, '../../../../schema/schema.sql'), 'utf8')
  const check = schema.match(/genre\s+TEXT CHECK \(genre IN \(([^)]*)\)\)/)
  expect(check).not.toBeNull()
  const allowed = check![1].split(',').map((g) => g.trim().replace(/^'|'$/g, ''))
  expect([...GENRES]).toEqual(allowed)
})
