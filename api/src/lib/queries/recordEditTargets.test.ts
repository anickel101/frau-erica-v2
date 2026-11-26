import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb } from '../testFixtures'
import {
  getEditableGallery,
  getEditableImage,
  getEditableSeries,
  listEditableImages,
} from './recordEditTargets'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  db.run(
    `INSERT INTO Images (image_id, url, caption, is_published)
     VALUES (900, 'Pandas.jpg', 'The team.', 1), (901, 'Hidden.jpg', NULL, 0)`,
  )
  db.run(
    `INSERT INTO Galleries (gallery_id, name, summary) VALUES (900, 'Brown', 'Hockey.')`,
  )
  db.run(
    `INSERT INTO Series (series_key, slug, name, kind, blurb)
     VALUES ('FredKnief', 'fred-knief', 'Fred Knief', 'person', 'His essays.')`,
  )
})

describe('photographs', () => {
  test('only published ones can be edited', () => {
    expect(listEditableImages(db).map((i) => i.image_id)).toContain(900)
    expect(listEditableImages(db).map((i) => i.image_id)).not.toContain(901)
    expect(getEditableImage(db, 900)?.caption).toBe('The team.')
    expect(getEditableImage(db, 901)).toBeNull()
  })
})

test('a gallery, by id', () => {
  expect(getEditableGallery(db, 900)).toEqual({
    gallery_id: 900,
    name: 'Brown',
    summary: 'Hockey.',
  })
  expect(getEditableGallery(db, 999)).toBeNull()
})

test('a collection, by its key', () => {
  expect(getEditableSeries(db, 'FredKnief')?.blurb).toBe('His essays.')
  expect(getEditableSeries(db, 'NoSuch')).toBeNull()
})
