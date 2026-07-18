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
      linkedFamilyId: 1,
      otherFamilyId: null,
    })
    expect(family?.person_2).toEqual({
      person_id: 4,
      first_name: 'Karl',
      last_name: 'Schmidt',
      date_of_birth: '1949-11-02',
      linkedFamilyId: 1,
      otherFamilyId: null,
    })

    expect(family?.grandparents_1.map((p) => p.person_id).sort()).toEqual([1, 2])
    expect(family?.grandparents_2.map((p) => p.person_id).sort()).toEqual([5, 6])

    expect(family?.children.map((p) => p.person_id).sort()).toEqual([7, 8])
  })

  test('embeds a linkedFamilyId on every shown person for one-hop navigation', () => {
    const family = getFamilyById(db, 1)

    // Anna and Karl's only partner family is this one.
    expect(family?.person_1?.linkedFamilyId).toBe(1)
    expect(family?.person_2?.linkedFamilyId).toBe(1)

    // Otto and Ida's only partner family is family_id 3, not this one.
    const otto = family?.grandparents_2.find((p) => p.person_id === 5)
    expect(otto?.linkedFamilyId).toBe(3)

    // Lena has no partner family of her own yet -- falls back to the
    // family she appears in as a child, which is this one.
    const lena = family?.children.find((p) => p.person_id === 7)
    expect(lena?.linkedFamilyId).toBe(1)
  })

  test('resolves header_image_url to the raw filename, not a full URL', () => {
    const family = getFamilyById(db, 1)
    expect(family?.header_image_url).toBe('family1.jpg')
  })

  test('handles a family with no header image', () => {
    const family = getFamilyById(db, 2)
    expect(family?.header_image_url).toBeNull()
  })

  test('excludes an unpublished linked image', () => {
    const family = getFamilyById(db, 3)
    expect(family?.header_image_url).toBeNull()
  })

  test('only includes galleries linked to the couple, not grandparents, and only if published', () => {
    const family1 = getFamilyById(db, 1)
    // Anna and Karl are the couple for family 1. Gallery 1 (linked to
    // Anna) qualifies. Gallery 2 (linked to Karl) has no published
    // photo, excluded. Gallery 3 (linked to Hans) doesn't count -- Hans
    // is a grandparent of this family, not the couple.
    expect(family1?.galleries).toEqual([{ gallery_id: 1, name: 'Family Reunion 2020' }])
  })

  test('the same gallery counts for a different family where that person is the couple', () => {
    // Hans is a grandparent for family 1, but he's literally the couple
    // for family 2 (Hans and Greta) -- Gallery 3 should show up here.
    const family2 = getFamilyById(db, 2)
    expect(family2?.galleries).toEqual([{ gallery_id: 3, name: 'Hans Solo' }])
  })

  test('empty galleries array when nobody in the couple has a linked gallery', () => {
    const family3 = getFamilyById(db, 3)
    expect(family3?.galleries).toEqual([])
  })

  test('handles a single-parent family (nullable person_id_2)', () => {
    const family = getFamilyById(db, 4)
    expect(family?.person_1?.person_id).toBe(1)
    expect(family?.person_2).toBeNull()
    expect(family?.grandparents_2).toEqual([])
  })

  test("coupleStatus reflects the featured couple's own spouse Relationships row", () => {
    const divorced = getFamilyById(db, 5)
    expect(divorced?.coupleStatus).toBe('divorced')

    // Anna and Karl have no spouse Relationships row on record at all.
    const noRelationshipRow = getFamilyById(db, 1)
    expect(noRelationshipRow?.coupleStatus).toBeNull()
  })

  test('coupleStatus is null when the family has only one parent', () => {
    const family = getFamilyById(db, 4)
    expect(family?.coupleStatus).toBeNull()
  })

  test('otherFamilyId resolves to the other Families row for a remarried person, in both directions', () => {
    // Klaus (13) partners in both family 6 (Wife One) and family 7 (Wife Two).
    const family7 = getFamilyById(db, 7)
    expect(family7?.person_1?.person_id).toBe(13)
    expect(family7?.person_1?.otherFamilyId).toBe(6)

    const family6 = getFamilyById(db, 6)
    expect(family6?.person_1?.person_id).toBe(13)
    expect(family6?.person_1?.otherFamilyId).toBe(7)
  })

  test('otherFamilyId is null for someone with only one family on record', () => {
    const family = getFamilyById(db, 1)
    expect(family?.person_1?.otherFamilyId).toBeNull() // Anna
    expect(family?.person_2?.otherFamilyId).toBeNull() // Karl
  })
})
