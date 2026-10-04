import type { Database } from 'sql.js'
import { beforeEach, describe, expect, test } from 'vitest'
import { createTestDb } from '../testFixtures'
import {
  HEADER_IMAGES_GROUP,
  MISCELLANEOUS_GROUP,
  imageIsInGallery,
  personExists,
} from './photoTagTargets'

// Against a real schema-built database, not a mock -- the point of these
// two functions is that they agree with the actual tables, so testing
// them against a stub would prove nothing.
let db: Database

beforeEach(async () => {
  db = await createTestDb()
  db.run(
    `INSERT INTO Persons (person_id, first_name, last_name) VALUES (23, 'Anson', 'Nickel')`,
  )
  db.run(`INSERT INTO Images (image_id, url, is_published) VALUES (500, 'a.jpg', 1)`)
  db.run(`INSERT INTO Images (image_id, url, is_published) VALUES (900, 'b.jpg', 1)`)
  db.run(`INSERT INTO Galleries (gallery_id, name) VALUES (12, 'Anson')`)
  db.run(`INSERT INTO Galleries (gallery_id, name) VALUES (19, 'Mark and Alli')`)
  db.run(`INSERT INTO GalleryImages (gallery_id, image_id) VALUES (12, 500)`)
})

describe('personExists', () => {
  test('finds a real person', () => {
    expect(personExists(db, 23)).toBe(true)
  })

  test('rejects an id nobody has', () => {
    expect(personExists(db, 99999)).toBe(false)
  })
})

describe('imageIsInGallery', () => {
  test('accepts a photograph that is in the gallery', () => {
    expect(imageIsInGallery(db, 500, 12)).toBe(true)
  })

  // The pairing is what matters, not that each id exists on its own: a
  // tag filed under the wrong gallery is invisible to the by-gallery
  // index the tagging page reads.
  test('rejects a real photograph in the wrong gallery', () => {
    expect(imageIsInGallery(db, 500, 19)).toBe(false)
  })

  test('rejects a photograph in no gallery at all', () => {
    expect(imageIsInGallery(db, 900, 12)).toBe(false)
  })

  test('rejects an image id that does not exist', () => {
    expect(imageIsInGallery(db, 99999, 12)).toBe(false)
  })
})

// The two synthetic groups, for the 263 published photographs that
// belong to no gallery. They are not Galleries rows -- adding them as
// real ones would put "Header images" on the public Index of Galleries.
describe('the synthetic groups', () => {
  beforeEach(() => {
    db.run(
      `INSERT INTO Images (image_id, url, is_published) VALUES (700, 'hdr.Farm.jpg', 1)`,
    )
    db.run(
      `INSERT INTO Images (image_id, url, is_published) VALUES (701, 'Letter.jpg', 1)`,
    )
    db.run(
      `INSERT INTO Images (image_id, url, is_published) VALUES (702, 'hdr.InGallery.jpg', 1)`,
    )
    db.run(`INSERT INTO GalleryImages (gallery_id, image_id) VALUES (12, 702)`)
    db.run(
      `INSERT INTO Images (image_id, url, is_published) VALUES (703, 'Unpublished.jpg', 0)`,
    )
  })

  test('a header image outside any gallery belongs to the header group', () => {
    expect(imageIsInGallery(db, 700, HEADER_IMAGES_GROUP)).toBe(true)
  })

  test('a non-header outside any gallery belongs to miscellaneous', () => {
    expect(imageIsInGallery(db, 701, MISCELLANEOUS_GROUP)).toBe(true)
  })

  // The groups are "outside a gallery" by definition. A header image
  // that IS in a gallery is taggable there, and listing it in both
  // places would show the same photograph twice.
  test('a header image already in a gallery is not in the header group', () => {
    expect(imageIsInGallery(db, 702, HEADER_IMAGES_GROUP)).toBe(false)
    expect(imageIsInGallery(db, 702, 12)).toBe(true)
  })

  test('the two groups do not overlap', () => {
    expect(imageIsInGallery(db, 700, MISCELLANEOUS_GROUP)).toBe(false)
    expect(imageIsInGallery(db, 701, HEADER_IMAGES_GROUP)).toBe(false)
  })

  test('an unpublished image belongs to neither', () => {
    expect(imageIsInGallery(db, 703, MISCELLANEOUS_GROUP)).toBe(false)
    expect(imageIsInGallery(db, 703, HEADER_IMAGES_GROUP)).toBe(false)
  })

  test('an unknown group id matches nothing', () => {
    expect(imageIsInGallery(db, 700, -99)).toBe(false)
  })
})
