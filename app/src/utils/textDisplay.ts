import {
  Collection,
  MINIMUM_COLLECTION_SIZE,
  getCollectionByKey,
} from '../data-access/public/collections'
import { DocumentListItem } from '../data-access/public/documents'
import { mockPersons } from '../data/mockPersons'
import { Person } from '../types/person'

export type TextIndexEntry =
  | { kind: 'standalone'; document: DocumentListItem }
  | {
      kind: 'series'
      seriesKey: string
      // The collection's real name, from the Series table -- no longer
      // a chapter kicker standing in for one.
      seriesTitle: string
      // Present whenever the archive knows this group as a collection,
      // which since the Series table is always. Kept optional so a
      // series_key with no Series row degrades to a titled group rather
      // than crashing the index.
      collection?: Collection
      chapters: DocumentListItem[]
    }

export interface FilteredTextEntry {
  entry: TextIndexEntry
  matchedChapterIds: number[]
  autoExpand: boolean
}

// A kicker as displayed. 64 of the 108 published series_title values end
// in a colon -- "Introduction:", "In His Own Hand:", "Christmas 1995:" --
// left over from the old site, where the kicker and the title ran
// together on one line and the colon joined them. On their own line the
// colon points at nothing. Stripped in display only; the data is left
// as entered.
export function displayKicker(kicker: string | null): string | null {
  if (kicker === null) return null
  const trimmed = kicker.replace(/\s*:\s*$/, '').trim()
  return trimmed === '' ? null : trimmed
}

export function getAuthorPerson(document: DocumentListItem): Person | undefined {
  if (document.authorPersonId == null) return undefined
  return mockPersons.find((p) => p.person_id === document.authorPersonId)
}

// The chapter that stands for the whole series on the index: its summary
// and byline are the ones shown. The LOWEST series_order, found
// explicitly rather than assumed.
//
// This used to look for series_order === 1 and fall back to chapters[0].
// Fourteen of the nineteen series don't start at 1. Eleven start at 2
// because their Part I is unpublished, and for those the fallback
// happened to be right. But three -- Fritz's journal, Carl de Haas,
// Nana's memoir -- number their introduction 0, so chapter 1 exists and
// was chosen over it: the index showed chapter 0's title with chapter 1's
// summary, two different documents stitched together as one row.
export function getSeriesRepresentative(chapters: DocumentListItem[]): DocumentListItem {
  return chapters.reduce((best, c) =>
    (c.series_order ?? Infinity) < (best.series_order ?? Infinity) ? c : best,
  )
}

export function groupTexts(documents: DocumentListItem[]): TextIndexEntry[] {
  const entries: TextIndexEntry[] = []
  const seriesByKey = new Map<string, Extract<TextIndexEntry, { kind: 'series' }>>()

  for (const document of documents) {
    if (!document.series_key) {
      entries.push({ kind: 'standalone', document })
      continue
    }

    const existing = seriesByKey.get(document.series_key)
    if (existing) {
      existing.chapters.push(document)
      continue
    }

    const series: Extract<TextIndexEntry, { kind: 'series' }> = {
      kind: 'series',
      seriesKey: document.series_key,
      // Provisional -- replaced below once every chapter is collected,
      // so the label and the representative come from the same chapter.
      seriesTitle: displayKicker(document.series_title) ?? document.title,
      chapters: [document],
    }
    seriesByKey.set(document.series_key, series)
    entries.push(series)
  }

  // Second pass, once every chapter is in place: name each group, and
  // demote the ones too small to be a collection.
  //
  // The name now comes from the Series table. It used to be taken from
  // series_title, which is a per-chapter kicker ("Introduction:", "In
  // His Own Hand:", "Christmas 1995:") pressed into service as a series
  // name because nothing better was recorded -- which is how a run of 28
  // Christmas letters came to be called "Christmas 1995:". The fallback
  // below is the old behaviour, kept only for a series_key with no
  // Series row; the export refuses to ship one of those.
  const named: TextIndexEntry[] = []
  for (const entry of entries) {
    if (entry.kind !== 'series') {
      named.push(entry)
      continue
    }

    entry.chapters.sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0))
    const collection = getCollectionByKey(entry.seriesKey)

    // One published text is not a collection. Listing it as an ordinary
    // text is more honest than a card promising a collection and
    // delivering a single document one click further away -- and the
    // group becomes a collection again on its own when a second text is
    // published. See MINIMUM_COLLECTION_SIZE.
    if (entry.chapters.length < MINIMUM_COLLECTION_SIZE) {
      for (const document of entry.chapters) {
        named.push({ kind: 'standalone', document })
      }
      continue
    }

    entry.collection = collection
    const representative = getSeriesRepresentative(entry.chapters)
    entry.seriesTitle =
      collection?.name ??
      displayKicker(representative.series_title) ??
      representative.title
    named.push(entry)
  }

  return named
}

function includesQuery(value: string | null, q: string): boolean {
  return value != null && value.toLowerCase().includes(q)
}

export function filterTextEntries(
  entries: TextIndexEntry[],
  query: string,
): FilteredTextEntry[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return entries.map((entry) => ({ entry, matchedChapterIds: [], autoExpand: false }))

  const results: FilteredTextEntry[] = []

  for (const entry of entries) {
    if (entry.kind === 'standalone') {
      const { document } = entry
      const matches =
        includesQuery(document.title, q) || includesQuery(document.author, q)
      if (matches) results.push({ entry, matchedChapterIds: [], autoExpand: false })
      continue
    }

    const representative = getSeriesRepresentative(entry.chapters)
    const headerMatches =
      entry.seriesTitle.toLowerCase().includes(q) ||
      includesQuery(representative.author, q)

    const matchedChapterIds = entry.chapters
      .filter((c) => includesQuery(c.title, q) || includesQuery(c.author, q))
      .map((c) => c.document_id)

    if (headerMatches || matchedChapterIds.length > 0) {
      results.push({
        entry,
        matchedChapterIds,
        autoExpand: !headerMatches && matchedChapterIds.length > 0,
      })
    }
  }

  return results
}
