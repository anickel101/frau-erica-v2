import { describe, expect, it } from 'vitest'
import { DocumentDetail } from '../data-access/public/documentDetail'
import {
  displayKicker,
  filterTextEntries,
  getCollectionAuthors,
  getDocumentAuthors,
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
    language: null,
    parallel: null,
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

describe('groupTexts and collections', () => {
  // These use a real series_key, because the collection name comes from
  // the real collections.json -- that lookup is the behaviour under test.
  it('names a collection from the Series table, not a chapter kicker', () => {
    const entries = groupTexts([
      text({
        document_id: 1,
        title: 'I. Introduction',
        series_key: 'LudwigKnief',
        series_order: 1,
        series_title: 'Lebenslauf I:',
      }),
      text({
        document_id: 2,
        title: 'II. Childhood',
        series_key: 'LudwigKnief',
        series_order: 2,
        series_title: 'Lebenslauf II:',
      }),
    ])

    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.kind).toBe('series')
    if (entry.kind === 'series') {
      // Not "Lebenslauf I", which is what deriving from the kicker gave.
      // The asterisks are markdown: titles render through InlineMarkdown
      // now, so the German sets in italics as the archivist asked.
      expect(entry.seriesTitle).toBe("Ludwig Knief's *Lebenslauf*")
      expect(entry.collection?.slug).toBe('ludwig-kniefs-lebenslauf')
    }
  })

  // One published text is not a collection: a card promising one and
  // delivering a single document a click further away is worse than
  // just listing the document.
  it('lists a one-text group as an ordinary text', () => {
    const entries = groupTexts([
      text({
        document_id: 1,
        title: 'Obituary: The Rev. E.H.C. Mueller',
        series_key: 'OpaObit',
        series_order: 2,
      }),
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('standalone')
  })

  it('promotes the same group once a second text is published', () => {
    const entries = groupTexts([
      text({ document_id: 1, title: 'One', series_key: 'OpaObit', series_order: 1 }),
      text({ document_id: 2, title: 'Two', series_key: 'OpaObit', series_order: 2 }),
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('series')
  })

  it('leaves a document with no series alone', () => {
    const entries = groupTexts([text({ document_id: 1, title: 'A single text' })])
    expect(entries[0].kind).toBe('standalone')
  })
})

describe('getCollectionAuthors', () => {
  // The case this function exists for. Fritz Mueller's journal opens
  // with an introduction written by the archivist, so the lowest-ordered
  // chapter -- what getSeriesRepresentative returns -- carries the wrong
  // byline for the collection as a whole.
  // Six chapters by Fritz, two by the archivist, as the real collection
  // is shaped. An even split would tie, and the tie rule below would
  // then put the introduction first -- so the margin is the point.
  const fritz = [
    text({
      document_id: 86,
      title: 'Introduction',
      series_order: 0,
      author: 'Mark Nickel',
    }),
    ...[87, 88, 89, 90, 91, 92].map((id, i) =>
      text({
        document_id: id,
        title: `Chapter ${i + 1}`,
        series_order: i + 1,
        author: 'Fritz Mueller',
      }),
    ),
    text({
      document_id: 93,
      title: 'Postscript',
      series_order: 7,
      author: 'Mark Nickel',
    }),
  ]

  it('lists every author, most of the collection first', () => {
    expect(getSeriesRepresentative(fritz).author).toBe('Mark Nickel')
    expect(getCollectionAuthors(fritz).map((a) => a.name)).toEqual([
      'Fritz Mueller',
      'Mark Nickel',
    ])
  })

  it('names each author once however many chapters they wrote', () => {
    // Joel Nickel wrote all twenty-one Chicago memoirs; the byline is
    // his name once, not twenty-one times.
    const chicago = [1, 2, 3, 4].map((id) =>
      text({
        document_id: id,
        title: `Part ${id}`,
        series_order: id,
        author: 'Joel Nickel',
      }),
    )
    expect(getCollectionAuthors(chicago).map((a) => a.name)).toEqual(['Joel Nickel'])
  })

  it('breaks a tie toward the earliest chapter in reading order', () => {
    const tied = [
      text({ document_id: 2, title: 'Second', series_order: 2, author: 'B' }),
      text({ document_id: 1, title: 'First', series_order: 1, author: 'A' }),
    ]
    expect(getCollectionAuthors(tied).map((a) => a.name)).toEqual(['A', 'B'])
  })

  it('ignores chapters with no author, and returns nothing when none has one', () => {
    const some = [
      text({ document_id: 1, title: 'One', series_order: 1 }),
      text({ document_id: 2, title: 'Two', series_order: 2, author: 'Only' }),
    ]
    expect(getCollectionAuthors(some).map((a) => a.name)).toEqual(['Only'])
    expect(getCollectionAuthors([text({ document_id: 9, title: 'None' })])).toEqual([])
  })
})

describe('getDocumentAuthors', () => {
  it('gives one author as a one-element list, and none as an empty one', () => {
    expect(
      getDocumentAuthors(
        text({ document_id: 1, title: 'T', author: 'Kurt Mueller' }),
      ).map((a) => a.name),
    ).toEqual(['Kurt Mueller'])
    expect(getDocumentAuthors(text({ document_id: 2, title: 'T' }))).toEqual([])
  })
})
