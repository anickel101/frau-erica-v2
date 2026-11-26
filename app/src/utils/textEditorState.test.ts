import { describe, expect, test } from 'vitest'
import type { EditableTextDetail, TextEdit } from '../data-access/gated/textEdits'
import {
  changedFields,
  fromPairs,
  pairProblems,
  toPairs,
  discardChanges,
  insertBlock,
  insertLink,
  openingValues,
  searchImages,
  submitChanges,
  wrapSelection,
} from './textEditorState'

const text: EditableTextDetail = {
  document_id: 16,
  title: 'Two golden anniversaries',
  series_key: null,
  series_title: null,
  series_order: null,
  author: 'Mark Nickel',
  author_person_id: 18,
  genre: 'Biography',
  summary: null,
  tags: null,
  person_ids: [],
  content: 'Women at Brown.\n\nThe Pandas.',
  bilingual: false,
  content_de: null,
}

function edit(
  field: string,
  value: string | null,
  status: TextEdit['status'] = 'draft',
): TextEdit {
  return {
    document_id: 16,
    field,
    value,
    was: null,
    status,
    edited_by: 'dad@example.com',
    edited_at: '2026-11-25T12:00:00Z',
  }
}

describe('openingValues', () => {
  test('the archive, with pending edits by anyone laid over it', () => {
    const values = openingValues(text, [
      edit('content', 'Rewritten.'),
      edit('genre', 'Memoir'),
      edit('summary', 'Hockey and song.', 'submitted'),
    ])
    expect(values).toEqual({
      title: 'Two golden anniversaries',
      summary: 'Hockey and song.',
      content: 'Rewritten.',
      content_de: '',
    })
  })

  test('an absent summary opens as an empty box', () => {
    expect(openingValues(text, []).summary).toBe('')
  })
})

describe('changedFields', () => {
  const saved = { title: 'A', summary: '', content: 'Body.', content_de: 'Text.' }

  test('only what changed since the last save', () => {
    expect(changedFields(saved, { ...saved, content: 'Body!' }, false)).toEqual({
      content: 'Body!',
    })
  })

  test('a German body only for a bilingual text', () => {
    const changed = { ...saved, content_de: 'Text!' }
    expect(changedFields(saved, changed, true)).toEqual({ content_de: 'Text!' })
    expect(changedFields(saved, changed, false)).toEqual({})
  })
})

describe('submitChanges', () => {
  test('everything that differs from the archive, plus pending fields', () => {
    const values = { ...openingValues(text, []), content: 'New body.' }
    // The summary was edited and then put back: still sent, to withdraw it.
    expect(submitChanges(text, values, [edit('summary', 'Old draft')])).toEqual({
      content: 'New body.',
      summary: '',
    })
  })

  test('nothing when nothing differs and nothing is pending', () => {
    expect(submitChanges(text, openingValues(text, []), [])).toEqual({})
  })
})

describe('discardChanges', () => {
  test("sends the archive's values back for every pending field", () => {
    expect(
      discardChanges(text, [
        edit('content', 'Draft.'),
        edit('title', 'T'),
        edit('genre', 'Memoir'),
      ]),
    ).toEqual({
      content: 'Women at Brown.\n\nThe Pandas.',
      title: 'Two golden anniversaries',
    })
  })
})

describe('toolbar', () => {
  test('wraps a selection, keeping it selected', () => {
    const result = wrapSelection('a big barn', 2, 5, '**', 'bold text')
    expect(result.value).toBe('a **big** barn')
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe('big')
  })

  test('with nothing selected, inserts a placeholder to type over', () => {
    const result = wrapSelection('ab', 1, 1, '*', 'italic text')
    expect(result.value).toBe('a*italic text*b')
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe(
      'italic text',
    )
  })

  test('a link leaves its address selected', () => {
    const result = insertLink('see Brown here', 4, 9)
    expect(result.value).toBe('see [Brown](https://) here')
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe(
      'https://',
    )
  })

  test.each([
    ['mid-sentence', 'He left. She stayed.', 9, 'He left.\n\n{{image:5}}\n\nShe stayed.'],
    ['at the start', 'Text.', 0, '{{image:5}}\n\nText.'],
    ['at the end', 'Text.', 5, 'Text.\n\n{{image:5}}'],
    ['between paragraphs', 'One.\n\nTwo.', 6, 'One.\n\n{{image:5}}\n\nTwo.'],
    ['into an empty body', '', 0, '{{image:5}}'],
  ])('a photograph becomes its own paragraph, %s', (_case, value, position, expected) => {
    expect(insertBlock(value, position, '{{image:5}}').value).toBe(expected)
  })
})

describe('searchImages', () => {
  const images = [
    {
      image_id: 1,
      title: 'Pandas',
      caption: 'The Brown team, 1973',
      url: 'Alli_Hockey.jpg',
    },
    { image_id: 2, title: null, caption: 'Joel in Chicago', url: 'Chicago3.jpg' },
    { image_id: 15, title: null, caption: null, url: 'JoelNickel1.jpg' },
  ]

  test('every word must appear in the title, caption or file name', () => {
    expect(searchImages(images, 'joel chicago').map((i) => i.image_id)).toEqual([2])
    expect(searchImages(images, 'joel').map((i) => i.image_id)).toEqual([2, 15])
    expect(searchImages(images, 'hockey brown').map((i) => i.image_id)).toEqual([1])
  })

  test('a number finds that photograph', () => {
    expect(searchImages(images, '15').map((i) => i.image_id)).toEqual([15])
  })

  test('an empty query lists the first few', () => {
    expect(searchImages(images, '  ', 2)).toHaveLength(2)
  })
})

describe('paragraph pairs', () => {
  test('split two bodies into German-beside-English rows', () => {
    expect(toPairs('One.\n\nTwo.', 'Eins.\n\nZwei.')).toEqual([
      { de: 'Eins.', en: 'One.' },
      { de: 'Zwei.', en: 'Two.' },
    ])
  })

  test('a half that is a paragraph short gets an empty cell, not a lost one', () => {
    expect(toPairs('One.\n\nTwo.\n\nThree.', 'Eins.')).toEqual([
      { de: 'Eins.', en: 'One.' },
      { de: '', en: 'Two.' },
      { de: '', en: 'Three.' },
    ])
  })

  test('an empty text opens with one row to type in', () => {
    expect(toPairs('', '')).toEqual([{ de: '', en: '' }])
  })

  test('join back into two bodies', () => {
    expect(
      fromPairs([
        { de: ' Eins. ', en: 'One.' },
        { de: 'Zwei.', en: 'Two.' },
      ]),
    ).toEqual({
      content: 'One.\n\nTwo.',
      content_de: 'Eins.\n\nZwei.',
    })
  })

  test('name each row that would not pair, and why', () => {
    const problems = pairProblems([
      { de: 'Eins.', en: 'One.' },
      { de: '', en: 'Two.' },
      { de: 'Drei.\n\nVier.', en: 'Three.' },
    ])
    expect(problems.map((p) => [p.row, p.message.slice(0, 34)])).toEqual([
      [1, 'The German is empty.'],
      [2, 'The German has a blank line in it,'],
    ])
  })

  test('a line break inside a paragraph is fine', () => {
    expect(
      pairProblems([{ de: 'Zeile eins\nZeile zwei', en: 'Line one\nLine two' }]),
    ).toEqual([])
  })
})
