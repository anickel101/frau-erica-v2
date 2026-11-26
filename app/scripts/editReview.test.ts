import { describe, expect, test } from 'vitest'
import { documentStatement, judge, sqlLiteral, wordDiff } from './editReview.ts'

describe('judge', () => {
  test('ready when the archive still holds what the edit saw', () => {
    expect(judge('Memoir', 'Other', 'Other')).toBe('ready')
  })
  test('already applied when the archive already says it', () => {
    expect(judge('Memoir', 'Other', 'Memoir')).toBe('already applied')
  })
  test('a conflict when the archive changed in the meantime', () => {
    expect(judge('Memoir', 'Other', 'Letter')).toBe('conflict')
  })
  test('null is a value like any other', () => {
    expect(judge('Mark Nickel', null, null)).toBe('ready')
    expect(judge(null, 'Mark Nickel', null)).toBe('already applied')
  })
})

describe('sqlLiteral', () => {
  test('quotes text, doubling apostrophes', () => {
    expect(sqlLiteral("Don't come!")).toBe("'Don''t come!'")
  })
  test('numbers, booleans and null', () => {
    expect(sqlLiteral(18)).toBe('18')
    expect(sqlLiteral(true)).toBe('1')
    expect(sqlLiteral(null)).toBe('NULL')
  })
})

describe('documentStatement', () => {
  test('a shared field is written to both halves of a pair', () => {
    expect(documentStatement(82, 'author_person_id', 136)).toBe(
      'UPDATE Documents SET author_person_id = 136 WHERE document_id = 82 OR parallel_of = 82;',
    )
  })
  test('the summary belongs to the entry point alone', () => {
    expect(documentStatement(82, 'summary', 'A wedding.')).toBe(
      "UPDATE Documents SET summary = 'A wedding.' WHERE document_id = 82;",
    )
  })
  test('a title is shared with a German half; a body is not', () => {
    expect(documentStatement(82, 'title', 'A wedding')).toMatch(
      /WHERE document_id = 82 OR parallel_of = 82;$/,
    )
    expect(documentStatement(82, 'content', 'It rained.')).toBe(
      "UPDATE Documents SET content = 'It rained.' WHERE document_id = 82;",
    )
  })

  test("a German body is written to the German half, by the entry point's id", () => {
    expect(documentStatement(298, 'content_de', 'Abendglocken.')).toBe(
      "UPDATE Documents SET content = 'Abendglocken.' WHERE parallel_of = 298;",
    )
  })

  test('a link inserts; an unlink removes from both halves', () => {
    expect(documentStatement(73, 'person#529', true)).toBe(
      'INSERT INTO DocumentLinks (document_id, person_id) VALUES (73, 529);',
    )
    expect(documentStatement(73, 'person#529', false)).toMatch(
      /DELETE FROM DocumentLinks WHERE person_id = 529\s+AND \(document_id = 73 OR document_id IN/,
    )
  })
  // A field name goes straight into SQL, so anything not on the list is
  // refused rather than trusted because it came from our own table.
  test.each(['content; DROP TABLE Documents', 'is_published', 'person#x', 'person#0'])(
    'refuses field %j',
    (field) => {
      expect(() => documentStatement(1, field, 'x')).toThrow()
    },
  )
})

describe('wordDiff', () => {
  test('marks removed and added words', () => {
    expect(wordDiff('the old red barn', 'the new red barn')).toBe(
      'the [-old-] {+new+} red barn',
    )
  })

  test('cuts long unchanged stretches down to the words near a change', () => {
    const words = Array.from({ length: 40 }, (_, i) => `w${i}`)
    const after = [...words]
    after[20] = 'CHANGED'
    expect(wordDiff(words.join(' '), after.join(' '), 3)).toBe(
      '… w17 w18 w19 [-w20-] {+CHANGED+} w21 w22 w23 …',
    )
  })

  test('shows a paragraph break added or removed', () => {
    expect(wordDiff('one two three four', 'one two\n\nthree four')).toBe(
      'one two {+¶+} three four',
    )
  })

  test('a deleted sentence stands out in a long text', () => {
    const before = 'He left. She stayed behind. They wrote often.'
    expect(wordDiff(before, 'He left. They wrote often.')).toBe(
      'He left. [-She stayed behind.-] They wrote often.',
    )
  })

  test('says so when only the spacing changed', () => {
    expect(wordDiff('a  b\nc', 'a b c')).toBe('(no change in wording)')
  })

  test('a rewrite too large to align is reported as replaced', () => {
    const before = Array.from({ length: 2500 }, (_, i) => `a${i}`).join(' ')
    const after = Array.from({ length: 2500 }, (_, i) => `b${i}`).join(' ')
    const diff = wordDiff(before, after)
    expect(diff.startsWith('[-a0 a1')).toBe(true)
    expect(diff).toContain('{+b0 b1')
  })
})
