import { describe, expect, it } from 'vitest'
import { proposeDate } from './dateProposer.ts'
import type { DocumentForDating } from './dateProposer.ts'

function doc(overrides: Partial<DocumentForDating>): DocumentForDating {
  return {
    document_id: 1,
    title: 'Untitled',
    series_title: null,
    summary: null,
    content: null,
    ...overrides,
  }
}

describe('proposeDate', () => {
  it('takes a bare year from the title, confidently', () => {
    const { proposal } = proposeDate(doc({ title: 'Chicago 1967 (2)' }))
    expect(proposal).toMatchObject({ display: '1967', sort: '1967', confidence: 'high' })
  })

  it('takes a full date from the title at full precision', () => {
    const { proposal } = proposeDate(doc({ title: 'A letter of November 8, 1933' }))
    expect(proposal).toMatchObject({ display: 'November 8, 1933', sort: '1933-11-08' })
  })

  it('reads a German dateline, the form the journals are written in', () => {
    const { proposal } = proposeDate(
      doc({
        content: 'Auf der Rhede von Bremerhafen, den 19. August 1865.\n\nWir haben...',
      }),
    )
    // Normalised to the archive's house style, not the source's order.
    expect(proposal).toMatchObject({ display: 'August 19, 1865', sort: '1865-08-19' })
    expect(proposal?.confidence).toBe('medium')
  })

  // The regression this module exists to prevent, and which the first
  // version of it actually committed: two FULL DATES joined by a dash
  // contain no YYYY-YYYY pair, so a dash-based lifespan check missed it
  // and proposed the birth date -- at high confidence -- as the date of
  // the document.
  it('declines a title that carries two full dates', () => {
    const { proposal, declined } = proposeDate(
      doc({ title: 'Alice Ingram Hooker\nNovember 8, 1933 – July 23, 2019' }),
    )
    expect(proposal).toBeNull()
    expect(declined).toContain('1933')
    expect(declined).toContain('2019')
  })

  it('declines a title naming a span of years', () => {
    const { proposal, declined } = proposeDate(
      doc({ title: 'Our Redeemer Lutheran Church, 1967-1972' }),
    )
    expect(proposal).toBeNull()
    expect(declined).toContain('covers a period')
  })

  // A year in a summary usually dates the SUBJECT, not the text. It is
  // still worth proposing -- it is a real starting point -- but it must
  // not arrive looking as trustworthy as a title.
  it('marks a year mentioned in a summary as low confidence', () => {
    const { proposal } = proposeDate(
      doc({ summary: 'A brief life of a man born in 1844 on the Wisconsin frontier.' }),
    )
    expect(proposal).toMatchObject({ display: '1844', confidence: 'low' })
    expect(proposal?.source).toContain("subject's date")
  })

  it('prefers the title over anything in the body', () => {
    const { proposal } = proposeDate(
      doc({ title: 'Christmas 1995', summary: 'Recalling the summer of 1976.' }),
    )
    expect(proposal?.display).toBe('1995')
    expect(proposal?.confidence).toBe('high')
  })

  it('proposes nothing when there is no year anywhere', () => {
    const { proposal, declined } = proposeDate(
      doc({ title: 'The Game of Five Rocks', summary: 'History and rules.' }),
    )
    expect(proposal).toBeNull()
    expect(declined).toBeUndefined()
  })

  // Sort keys are compared as strings, so they have to order correctly
  // at mixed precision -- a bare year against a full date in the same
  // year, which is what a timeline will actually be sorting.
  it('produces sort keys that order chronologically as plain strings', () => {
    const keys = [
      proposeDate(doc({ title: 'In 1995' })).proposal!.sort,
      proposeDate(doc({ title: 'March 1995 report' })).proposal!.sort,
      proposeDate(doc({ title: 'A note of March 4, 1995' })).proposal!.sort,
      proposeDate(doc({ title: 'In 1996' })).proposal!.sort,
    ]
    expect([...keys].sort()).toEqual(keys)
  })
})
