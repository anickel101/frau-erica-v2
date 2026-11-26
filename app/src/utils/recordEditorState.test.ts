import { describe, expect, test } from 'vitest'
import {
  archiveValues,
  changedFields,
  discardChanges,
  openingValues,
  submitChanges,
  type PendingEdit,
} from './recordEditorState'

const fields = ['title', 'caption', 'year_taken'] as const
const photo = {
  image_id: 246,
  url: 'KamKwai.jpg',
  title: null,
  caption: 'Lovable.',
  year_taken: null,
}

function edit(field: string, value: PendingEdit['value']): PendingEdit {
  return {
    field,
    value,
    status: 'draft',
    edited_by: 'dad@example.com',
    edited_at: '2026-11-26',
  }
}

test('the archive as strings, nothing as empty', () => {
  expect(archiveValues(photo, fields)).toEqual({
    title: '',
    caption: 'Lovable.',
    year_taken: '',
  })
})

test('pending edits by anyone laid over the archive, a year as text', () => {
  const values = openingValues(photo, fields, [
    edit('caption', 'Joyce and her sisters.'),
    edit('year_taken', 1962),
    edit('url', 'ignored.jpg'),
  ])
  expect(values).toEqual({
    title: '',
    caption: 'Joyce and her sisters.',
    year_taken: '1962',
  })
})

describe('what each save sends', () => {
  const archive = archiveValues(photo, fields)

  test('an autosave: only what changed since the last save', () => {
    expect(changedFields(archive, { ...archive, caption: 'New.' })).toEqual({
      caption: 'New.',
    })
  })

  test('Submit: what differs from the archive, plus pending fields put back', () => {
    const values = { ...archive, title: 'Three sisters' }
    expect(submitChanges(archive, values, [edit('caption', 'Old draft.')])).toEqual({
      title: 'Three sisters',
      caption: 'Lovable.',
    })
  })

  test("Discard: the archive's value for every pending field", () => {
    expect(
      discardChanges(archive, [edit('caption', 'Draft.'), edit('url', 'x')]),
    ).toEqual({
      caption: 'Lovable.',
    })
  })
})
