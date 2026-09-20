import { describe, expect, it } from 'vitest'
import { DocumentDetail } from '../data-access/public/documents'
import {
  displayKicker,
  filterTextEntries,
  getSeriesRepresentative,
  groupTexts,
} from './textDisplay'

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
    header_image_url: null,
    header_image_caption: null,
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

describe('displayKicker', () => {
  it('drops the trailing colon the old one-line layout needed', () => {
    expect(displayKicker('Introduction:')).toBe('Introduction')
    expect(displayKicker('In His Own Hand: ')).toBe('In His Own Hand')
  })

  it('leaves a kicker with no colon alone', () => {
    expect(displayKicker('Opened Doors — Walking Through')).toBe(
      'Opened Doors — Walking Through',
    )
  })

  it('treats a bare colon or nothing as no kicker at all', () => {
    expect(displayKicker(':')).toBeNull()
    expect(displayKicker(null)).toBeNull()
  })
})

describe('getSeriesRepresentative', () => {
  it('picks the lowest series_order, even when that is 0', () => {
    // Fritz's journal, Carl de Haas and Nana's memoir all number their
    // introduction 0. An earlier version looked for series_order === 1,
    // so those three rows showed chapter 0's title over chapter 1's
    // summary -- two different documents stitched into one entry.
    const intro = text({ document_id: 86, title: 'Journal', series_order: 0 })
    const first = text({ document_id: 87, title: 'In Bremerhaven', series_order: 1 })
    expect(getSeriesRepresentative([first, intro])).toBe(intro)
  })

  it('falls back to the earliest published chapter when Part I is missing', () => {
    // Eleven series start at 2 because their opening chapter is
    // unpublished. The row should stand on the earliest chapter that IS
    // there, not on nothing.
    const two = text({ document_id: 1, title: 'II', series_order: 2 })
    const three = text({ document_id: 2, title: 'III', series_order: 3 })
    expect(getSeriesRepresentative([three, two])).toBe(two)
  })
})

describe('groupTexts', () => {
  it('takes the series title from the same chapter the representative comes from', () => {
    // Regardless of the order the export happened to list them in.
    const documents = [
      text({
        document_id: 87,
        title: 'In Bremerhaven',
        series_key: 'F',
        series_order: 1,
        series_title: 'In His Own Hand:',
      }),
      text({
        document_id: 86,
        title: 'Journal',
        series_key: 'F',
        series_order: 0,
        series_title: 'Introduction:',
      }),
    ]
    const [entry] = groupTexts(documents)
    expect(entry.kind).toBe('series')
    if (entry.kind !== 'series') return
    expect(entry.seriesTitle).toBe('Introduction')
    expect(getSeriesRepresentative(entry.chapters).document_id).toBe(86)
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
