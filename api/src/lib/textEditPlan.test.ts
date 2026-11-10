import { describe, expect, test } from 'vitest'
import type { EditableText } from './queries/textEditTargets'
import { SUMMARY_MAX, planTextEdits, type TextEditPlan } from './textEditPlan'

const text: EditableText = {
  document_id: 40,
  title: 'Chicago 1972',
  series_key: 'Chicago',
  series_title: 'Chicago Memoirs',
  series_order: 3,
  author: 'Joel Nickel',
  author_person_id: 21,
  genre: 'Memoir',
  summary: 'A summer on the South Side.',
  tags: 'Nickel, Joel',
  person_ids: [21, 108],
}

function plan(body: unknown): TextEditPlan {
  const result = planTextEdits(text, body)
  if ('error' in result) throw new Error(result.error)
  return result
}

function error(body: unknown): string {
  const result = planTextEdits(text, body)
  if (!('error' in result)) throw new Error('expected an error')
  return result.error
}

describe('planTextEdits', () => {
  test('proposes a changed field, recording what the archive held', () => {
    expect(plan({ genre: 'History' }).put).toEqual([
      { field: 'genre', value: 'History', was: 'Memoir' },
    ])
  })

  // How an edit is withdrawn: send the archive's own value back.
  test("clears a field's pending edit when it matches the archive", () => {
    const result = plan({ genre: 'Memoir', author: 'Joel Nickel' })
    expect(result.put).toEqual([])
    expect(result.clear).toEqual(['author', 'genre'])
  })

  test('trims text, and treats an empty box as none', () => {
    expect(plan({ author: '  Opa  ' }).put[0].value).toBe('Opa')
    expect(plan({ author: '   ' }).put[0]).toEqual({
      field: 'author',
      value: null,
      was: 'Joel Nickel',
    })
  })

  // A textarea submits \r\n on some browsers. A summary that differs
  // from the archive only in its line endings is not an edit.
  test('ignores a difference in line endings alone', () => {
    const withBreak = { ...text, summary: 'One.\n\nTwo.' }
    const result = planTextEdits(withBreak, { summary: 'One.\r\n\r\nTwo.' })
    expect(result).toEqual({ put: [], clear: ['summary'], personIds: [] })
  })

  test('links and unlinks people', () => {
    const result = plan({ people: { 500: true, 108: false } })
    expect(result.put).toEqual([
      { field: 'person#108', value: false, was: true },
      { field: 'person#500', value: true, was: false },
    ])
  })

  test('linking someone already linked is no change', () => {
    expect(plan({ people: { 21: true } }).clear).toEqual(['person#21'])
  })

  // The caller checks these against Persons. An unlink is not checked:
  // removing a link to someone who doesn't exist is already a no-op.
  test('names the people the caller must confirm exist', () => {
    expect(
      plan({ author_person_id: 7, people: { 500: true, 108: false } }).personIds,
    ).toEqual([7, 500])
  })

  test('accepts clearing the author record', () => {
    expect(plan({ author_person_id: null }).put).toEqual([
      { field: 'author_person_id', value: null, was: 21 },
    ])
  })

  test.each([
    [{ auther: 'Opa' }, /Unknown field: auther/],
    [{ genre: 'Poetry' }, /genre must be one of/],
    [{ genre: null }, /genre must be one of/],
    [{ author: 12 }, /author must be text/],
    [{ author_person_id: '21' }, /author_person_id/],
    [{ author_person_id: 0 }, /author_person_id/],
    [{ summary: 'x'.repeat(SUMMARY_MAX + 1) }, /summary must be at most/],
    [{ people: [21] }, /people must map/],
    [{ people: { abc: true } }, /people must map/],
    [{ people: { 21: 'yes' } }, /people must map/],
    [{}, /Nothing to save/],
    [[], /Expected an object/],
  ])('refuses %j', (body, message) => {
    expect(error(body)).toMatch(message)
  })
})
