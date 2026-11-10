import { describe, expect, test } from 'vitest'
import type { EditableText, TextEdit } from '../data-access/gated/textEdits'
import {
  changesBetween,
  groupTexts,
  legacyTagSearches,
  matchesFilter,
  withPending,
} from './textEditState'

const text: EditableText = {
  document_id: 40,
  title: 'Chicago 1972',
  series_key: null,
  series_title: null,
  series_order: null,
  author: null,
  author_person_id: null,
  genre: 'Other',
  summary: 'A summer.',
  tags: null,
  person_ids: [21, 108],
}

function edit(field: string, value: TextEdit['value']): TextEdit {
  return { document_id: 40, field, value, was: null, edited_by: 'a', edited_at: '' }
}

describe('withPending', () => {
  test('lays pending edits over the archive', () => {
    const values = withPending(text, [
      edit('genre', 'Memoir'),
      edit('author', 'Joel Nickel'),
      edit('person#108', false),
      edit('person#500', true),
      { ...edit('genre', 'History'), document_id: 41 },
    ])
    expect(values).toEqual({
      author: 'Joel Nickel',
      author_person_id: null,
      genre: 'Memoir',
      summary: 'A summer.',
      person_ids: [21, 500],
    })
  })
})

describe('changesBetween', () => {
  const before = withPending(text, [])

  test('sends only what changed', () => {
    expect(changesBetween(before, { ...before, genre: 'Letter' })).toEqual({
      genre: 'Letter',
    })
  })

  test('sends links and unlinks', () => {
    expect(changesBetween(before, { ...before, person_ids: [21, 7] })).toEqual({
      people: { 7: true, 108: false },
    })
  })

  // An empty byline box and no byline are the same thing.
  test('treats an empty box as unchanged from none', () => {
    expect(changesBetween(before, { ...before, author: '' })).toEqual({})
  })
})

describe('matchesFilter', () => {
  const values = withPending(text, [])

  test('a text with no byline and no author record has no author', () => {
    expect(matchesFilter(values, false, 'no-author')).toBe(true)
    expect(matchesFilter({ ...values, author: 'Opa' }, false, 'no-author')).toBe(false)
  })

  test('judges the text as it will be, pending edits included', () => {
    const fixed = withPending(text, [edit('genre', 'Memoir')])
    expect(matchesFilter(fixed, true, 'other')).toBe(false)
    expect(matchesFilter(fixed, true, 'pending')).toBe(true)
  })
})

describe('legacyTagSearches', () => {
  test('turns each old-site tag into given name plus first surname', () => {
    expect(
      legacyTagSearches(
        'Mueller/Knief, Dora Elizabeth (Dodo); Rickmeyer/Mueller, Adelheid (Frau Erica)',
      ),
    ).toEqual([
      { label: 'Mueller/Knief, Dora Elizabeth (Dodo)', query: 'Dora Mueller' },
      { label: 'Rickmeyer/Mueller, Adelheid (Frau Erica)', query: 'Adelheid Rickmeyer' },
    ])
  })

  test('passes through a tag not in "Surname, Given" form', () => {
    expect(legacyTagSearches('Nana')).toEqual([{ label: 'Nana', query: 'Nana' }])
  })

  test('has nothing for no tags', () => {
    expect(legacyTagSearches(null)).toEqual([])
    expect(legacyTagSearches(' ; ')).toEqual([])
  })
})

describe('groupTexts', () => {
  test('collections alphabetically in reading order, then everything else', () => {
    const t = (
      id: number,
      title: string,
      series_key: string | null,
      order: number | null,
    ) => ({
      ...text,
      document_id: id,
      title,
      series_key,
      series_order: order,
    })
    const groups = groupTexts(
      [
        t(1, 'Zed', null, null),
        t(2, 'Two', 'B', 2),
        t(3, 'One', 'B', 1),
        t(4, 'Alpha', 'A', 1),
      ],
      (key) => ({ A: 'Annual letters', B: 'Bigelow' })[key],
    )
    expect(groups.map((g) => [g.name, g.texts.map((x) => x.document_id)])).toEqual([
      ['Annual letters', [4]],
      ['Bigelow', [3, 2]],
      ['Texts in no collection', [1]],
    ])
  })
})
