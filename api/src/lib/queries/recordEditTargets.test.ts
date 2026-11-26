import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb } from '../testFixtures'
import {
  getEditableGallery,
  getEditableImage,
  getEditableSeries,
  listEditableImages,
  listHiddenImages,
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
  test('the list holds published ones; the hidden list the rest', () => {
    expect(listEditableImages(db).map((i) => i.image_id)).toContain(900)
    expect(listEditableImages(db).map((i) => i.image_id)).not.toContain(901)
    expect(listHiddenImages(db).map((i) => i.image_id)).toEqual([901])
  })

  // How a hidden photograph is brought back: it has to be editable.
  test('either can be opened, saying whether it is published', () => {
    expect(getEditableImage(db, 900)).toMatchObject({
      caption: 'The team.',
      is_published: true,
    })
    expect(getEditableImage(db, 901)?.is_published).toBe(false)
    expect(getEditableImage(db, 999)).toBeNull()
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
