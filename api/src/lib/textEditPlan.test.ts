import { describe, expect, test } from 'vitest'
import type { EditableTextDetail } from './queries/textEditTargets'
import {
  CONTENT_MAX,
  SUMMARY_MAX,
  TITLE_MAX,
  planTextEdits,
  type TextEditPlan,
} from './textEditPlan'

const text: EditableTextDetail = {
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
  content: 'It was hot.\n\n{{image:12}}\n\nWe left in August.',
  bilingual: false,
  content_de: null,
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

describe('planTextEdits: title and body', () => {
  test('proposes a new title, recording the old one', () => {
    expect(plan({ title: 'Chicago, 1972' }).put).toEqual([
      { field: 'title', value: 'Chicago, 1972', was: 'Chicago 1972' },
    ])
  })

  test.each([
    ['', /needs a title/],
    ['   ', /needs a title/],
    ['Two\nlines', /single line/],
    ['x'.repeat(TITLE_MAX + 1), /at most/],
    [null, /must be text/],
  ])('refuses title %j', (title, message) => {
    expect(error({ title })).toMatch(message)
  })

  // The body is stored with its placeholders; the planner never resolves
  // or rewrites them, only compares and stores.
  test('proposes a new body, placeholders untouched', () => {
    const content = 'It was hot.\n\n{{image:12}}\n\nWe left in September.'
    expect(plan({ content }).put).toEqual([
      { field: 'content', value: content, was: text.content },
    ])
  })

  // A browser textarea submits \r\n; a body that differs only in its
  // line endings or a trailing newline is not an edit.
  test('a body differing only in line endings or edges clears instead', () => {
    const result = plan({ content: `${text.content.replace(/\n/g, '\r\n')}\n\n` })
    expect(result.put).toEqual([])
    expect(result.clear).toEqual(['content'])
  })

  test.each([
    ['', /can't be emptied/],
    ['\n\n  ', /can't be emptied/],
    ['x'.repeat(CONTENT_MAX + 1), /at most/],
    [42, /must be text/],
  ])('refuses body %j', (content, message) => {
    expect(error({ content })).toMatch(message)
  })

  test('an English-only text has no German body to edit', () => {
    expect(error({ content_de: 'Neu.' })).toMatch(/no German half/)
  })
})

describe('planTextEdits: a bilingual text', () => {
  const bilingual: EditableTextDetail = {
    ...text,
    bilingual: true,
    content: 'One.\n\nTwo.',
    content_de: 'Eins.\n\nZwei.',
  }
  const run = (body: unknown, status?: 'draft' | 'submitted') =>
    planTextEdits(bilingual, body, status)

  test('proposes a German body, recording the old one', () => {
    const result = run({ content_de: 'Eins!\n\nZwei.' })
    expect('put' in result && result.put).toEqual([
      { field: 'content_de', value: 'Eins!\n\nZwei.', was: 'Eins.\n\nZwei.' },
    ])
  })

  test('a paragraph added to both halves submits', () => {
    const result = run({
      content: 'One.\n\nTwo.\n\nThree.',
      content_de: 'Eins.\n\nZwei.\n\nDrei.',
    })
    expect('put' in result && result.put.map((e) => e.field)).toEqual([
      'content',
      'content_de',
    ])
  })

  // Checked against the archive's other half when only one is sent.
  test('submitting one half out of step with the other is refused, naming the counts', () => {
    const result = run({ content: 'One.\n\nTwo.\n\nThree.' })
    expect('error' in result && result.error).toMatch(
      /English has 3 paragraphs and the German 2/,
    )
  })

  test('a draft may be out of step while the editor works', () => {
    const result = run({ content: 'One.\n\nTwo.\n\nThree.' }, 'draft')
    expect('put' in result && result.put[0].field).toBe('content')
  })

  test('a blank line inside a paragraph counts as two', () => {
    const result = run({ content_de: 'Eins.\n\n\nZwei.\n  \nDrei.' })
    expect('error' in result && result.error).toMatch(/German 3/)
  })

  test('the German body cannot be emptied either', () => {
    const result = run({ content_de: '  ' })
    expect('error' in result && result.error).toMatch(/can't be emptied/)
  })

  test('a title change needs no pairing check', () => {
    const result = run({ title: 'Neuer Titel' })
    expect('put' in result && result.put[0].field).toBe('title')
  })
})
