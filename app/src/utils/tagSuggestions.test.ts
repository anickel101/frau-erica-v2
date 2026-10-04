import { describe, expect, it } from 'vitest'
import type { Person } from '../types/person'
import { captionNames, suggestPeople, unresolvedCaptionNames } from './tagSuggestions'

function person(overrides: Partial<Person> & Pick<Person, 'person_id'>): Person {
  return {
    first_name: 'First',
    middle_name: '',
    last_name: 'Last',
    suffix: '',
    date_of_birth: null,
    birth_year: null,
    date_of_death: null,
    death_year: null,
    linkedFamilyId: null,
    ...overrides,
  } as Person
}

const anson = person({ person_id: 23, first_name: 'Anson', last_name: 'Nickel' })
const markA = person({ person_id: 18, first_name: 'Mark', last_name: 'Nickel' })
const markB = person({ person_id: 99, first_name: 'Mark', last_name: 'Bigelow' })
const binyon = person({ person_id: 77, first_name: 'Binyon', last_name: 'Crawley' })
const everyone = [anson, markA, markB, binyon]

describe('captionNames', () => {
  it('finds the names in a real caption', () => {
    expect(
      captionNames(
        'Anson, not quite three in the summer of 1990, attended a soap show in Boston with Uncle Binyon and Aunt Ting.',
      ),
    ).toEqual(expect.arrayContaining(['Anson', 'Binyon', 'Boston', 'Ting']))
  })

  // Relationship words sit right next to the names and are capitalised
  // the same way. Keeping them would put "Uncle" on a suggestion button.
  it('drops relationship words, months and seasons', () => {
    const names = captionNames('Uncle Mark and Aunt Ting at Christmas, December 1990')
    expect(names).toContain('Mark')
    expect(names).not.toContain('Uncle')
    expect(names).not.toContain('Aunt')
    expect(names).not.toContain('Christmas')
    expect(names).not.toContain('December')
  })

  it('is not confused by markdown emphasis', () => {
    expect(captionNames('watching *Charlotte* on television')).toEqual(['Charlotte'])
  })

  it('copes with no caption', () => {
    expect(captionNames(null)).toEqual([])
  })
})

describe('suggestPeople', () => {
  // The strongest signal, and the one that improves as the work goes on:
  // a gallery is usually the same handful of faces over and over.
  it('leads with people already tagged elsewhere in the gallery', () => {
    const [first] = suggestPeople({
      caption: null,
      galleryPersonIds: [],
      taggedElsewhereInGallery: [18],
      alreadyOnThisPhoto: [],
      persons: everyone,
    })
    expect(first.person.person_id).toBe(18)
    expect(first.reason).toBe('in this gallery')
  })

  it('offers whoever the gallery is about', () => {
    const ids = suggestPeople({
      caption: null,
      galleryPersonIds: [23],
      taggedElsewhereInGallery: [],
      alreadyOnThisPhoto: [],
      persons: everyone,
    }).map((s) => s.person.person_id)
    expect(ids).toEqual([23])
  })

  it('offers a caption name that picks out exactly one person', () => {
    const suggestions = suggestPeople({
      caption: 'A photograph of Binyon at the lake',
      galleryPersonIds: [],
      taggedElsewhereInGallery: [],
      alreadyOnThisPhoto: [],
      persons: everyone,
    })
    expect(suggestions.map((s) => s.person.person_id)).toEqual([77])
    expect(suggestions[0].reason).toBe('named in the caption')
  })

  // Two Marks is not a suggestion, it is a quiz. These surface as a
  // search hint instead.
  it('refuses to guess between people who share a name', () => {
    const suggestions = suggestPeople({
      caption: 'With Uncle Mark',
      galleryPersonIds: [],
      taggedElsewhereInGallery: [],
      alreadyOnThisPhoto: [],
      persons: everyone,
    })
    expect(suggestions).toHaveLength(0)
  })

  it('never offers someone already on this photograph', () => {
    const suggestions = suggestPeople({
      caption: null,
      galleryPersonIds: [23],
      taggedElsewhereInGallery: [18],
      alreadyOnThisPhoto: [23, 18],
      persons: everyone,
    })
    expect(suggestions).toHaveLength(0)
  })

  it('does not offer the same person twice from two sources', () => {
    const suggestions = suggestPeople({
      caption: 'Anson again',
      galleryPersonIds: [23],
      taggedElsewhereInGallery: [23],
      alreadyOnThisPhoto: [],
      persons: everyone,
    })
    expect(suggestions).toHaveLength(1)
  })
})

describe('unresolvedCaptionNames', () => {
  it('reports an ambiguous name so it can be searched', () => {
    const suggestions = suggestPeople({
      caption: 'With Uncle Mark',
      galleryPersonIds: [],
      taggedElsewhereInGallery: [],
      alreadyOnThisPhoto: [],
      persons: everyone,
    })
    expect(unresolvedCaptionNames('With Uncle Mark', everyone, suggestions)).toEqual([
      'Mark',
    ])
  })

  // A place name is not a missing person, and offering it as one would
  // send the archivist searching for somebody called Boston.
  it('ignores a capitalised word nobody is named', () => {
    expect(unresolvedCaptionNames('A soap show in Boston', everyone, [])).toEqual([])
  })
})
