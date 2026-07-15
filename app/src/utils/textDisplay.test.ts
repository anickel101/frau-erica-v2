import { describe, expect, it } from 'vitest'
import { DocumentDetail } from '../data-access/public/documents'
import { filterTextEntries, groupTexts } from './textDisplay'

function text(
  overrides: Partial<DocumentDetail> & Pick<DocumentDetail, 'document_id' | 'title'>,
): DocumentDetail {
  return {
    series_key: null,
    series_title: null,
    series_order: null,
    author: null,
    authorPersonId: null,
    summary: null,
    content: '',
    genre: null,
    tags: null,
    ...overrides,
  }
}

describe('groupTexts', () => {
  it('passes standalone documents through unchanged', () => {
    const documents = [text({ document_id: 1, title: 'A Letter Home' })]
    expect(groupTexts(documents)).toEqual([
      { kind: 'standalone', document: documents[0] },
    ])
  })

  it('collapses documents sharing a series_key into one series entry, sorted by series_order', () => {
    const documents = [
      text({
        document_id: 2,
        title: 'Chapter Two',
        series_key: 's1',
        series_title: 'The Saga',
        series_order: 2,
      }),
      text({
        document_id: 1,
        title: 'Chapter One',
        series_key: 's1',
        series_title: 'The Saga',
        series_order: 1,
      }),
    ]

    const entries = groupTexts(documents)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      kind: 'series',
      seriesKey: 's1',
      seriesTitle: 'The Saga',
    })
    if (entries[0].kind === 'series') {
      expect(entries[0].chapters.map((c) => c.document_id)).toEqual([1, 2])
    }
  })
})

describe('filterTextEntries', () => {
  const series = groupTexts([
    text({
      document_id: 10,
      title: 'Arrival in Illinois',
      series_key: 'homestead',
      series_title: 'The Mueller Homestead Years',
      series_order: 1,
      author: 'Kurt Mueller',
    }),
    text({
      document_id: 11,
      title: 'Letters from the Front',
      series_key: 'homestead',
      series_title: 'The Mueller Homestead Years',
      series_order: 2,
      author: 'Kurt Mueller',
    }),
  ])

  it('returns every entry, unmarked, when the query is empty', () => {
    const results = filterTextEntries(series, '')
    expect(results).toEqual([
      { entry: series[0], matchedChapterIds: [], autoExpand: false },
    ])
  })

  it('matches on the series title without auto-expanding', () => {
    const results = filterTextEntries(series, 'Homestead')
    expect(results).toHaveLength(1)
    expect(results[0].autoExpand).toBe(false)
    expect(results[0].matchedChapterIds).toEqual([])
  })

  it('auto-expands when the query only matches inside a chapter, not the series header', () => {
    const results = filterTextEntries(series, 'front')
    expect(results).toHaveLength(1)
    expect(results[0].autoExpand).toBe(true)
    expect(results[0].matchedChapterIds).toEqual([11])
  })

  it('excludes series with no match anywhere', () => {
    const results = filterTextEntries(series, 'zzzznotfound')
    expect(results).toEqual([])
  })
})
