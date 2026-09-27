import { describe, expect, it } from 'vitest'
import { validateParallelTexts } from './parallelTextValidation.ts'
import type { ParallelRow } from './parallelTextValidation.ts'

function row(
  overrides: Partial<ParallelRow> & Pick<ParallelRow, 'document_id'>,
): ParallelRow {
  return {
    title: 'Untitled',
    content: 'One.\n\nTwo.\n\nThree.',
    summary: null,
    language: null,
    parallel_of: null,
    is_published: 1,
    ...overrides,
  }
}

// An English entry point and its German half, three paragraphs each.
function pair(
  overrides: { english?: Partial<ParallelRow>; german?: Partial<ParallelRow> } = {},
) {
  return [
    row({
      document_id: 87,
      language: 'en',
      title: 'In Bremerhaven',
      ...overrides.english,
    }),
    row({
      document_id: 229,
      language: 'de',
      parallel_of: 87,
      title: 'In Bremerhaven',
      ...overrides.german,
    }),
  ]
}

describe('validateParallelTexts', () => {
  it('accepts a well-formed pair', () => {
    const result = validateParallelTexts(pair())
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.pairCount).toBe(1)
  })

  it('accepts an archive with no pairs at all', () => {
    const result = validateParallelTexts([
      row({ document_id: 1 }),
      row({ document_id: 2 }),
    ])
    expect(result.errors).toEqual([])
    expect(result.pairCount).toBe(0)
  })

  // The reason this module exists. The site pairs by position, so an
  // unequal count renders without complaint and sets every paragraph
  // after the gap against the wrong translation.
  it('rejects halves with different paragraph counts', () => {
    const result = validateParallelTexts(pair({ german: { content: 'Eins.\n\nZwei.' } }))
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('2 paragraphs')
    expect(result.errors[0]).toContain('3')
  })

  it('rejects a pointer to a document that does not exist', () => {
    const result = validateParallelTexts([
      row({ document_id: 229, language: 'de', parallel_of: 999 }),
    ])
    expect(result.errors.join(' ')).toContain('does not exist')
  })

  it('rejects a document naming itself', () => {
    const result = validateParallelTexts([
      row({ document_id: 87, language: 'de', parallel_of: 87 }),
    ])
    expect(result.errors.join(' ')).toContain('itself')
  })

  it('rejects two documents claiming the same counterpart', () => {
    const result = validateParallelTexts([
      ...pair(),
      row({ document_id: 300, language: 'de', parallel_of: 87 }),
    ])
    expect(result.errors.join(' ')).toContain('can only have one')
  })

  it('rejects a chain of translations', () => {
    const result = validateParallelTexts([
      row({ document_id: 87, language: 'en' }),
      row({ document_id: 229, language: 'de', parallel_of: 87 }),
      row({ document_id: 300, language: 'en', parallel_of: 229 }),
    ])
    expect(result.errors.join(' ')).toContain('not a chain')
  })

  it('rejects a pair whose halves disagree about publication', () => {
    const result = validateParallelTexts(pair({ german: { is_published: 0 } }))
    expect(result.errors.join(' ')).toContain('publish together')
  })

  it('rejects a pair in the same language', () => {
    const result = validateParallelTexts(pair({ german: { language: 'en' } }))
    expect(result.errors.join(' ')).toContain('one document in each language')
  })

  it('rejects a pair with a language missing', () => {
    const result = validateParallelTexts(pair({ german: { language: null } }))
    expect(result.errors.join(' ')).toContain('no language set')
  })

  // Not fatal: the pair still renders correctly, the summary is simply
  // never shown.
  it('warns, but does not fail, when the translated half has a summary', () => {
    const result = validateParallelTexts(
      pair({ german: { summary: 'Eine Zusammenfassung.' } }),
    )
    expect(result.errors).toEqual([])
    expect(result.warnings.join(' ')).toContain('never appear')
  })

  it('warns about a half-finished split', () => {
    const result = validateParallelTexts([row({ document_id: 87, language: 'en' })])
    expect(result.errors).toEqual([])
    expect(result.warnings.join(' ')).toContain('no counterpart')
  })
})
