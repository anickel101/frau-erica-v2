import { TextData } from '../data/mockTexts'
import { Person, mockPersons } from '../data/mockPersons'

export type TextIndexEntry =
  | { kind: 'standalone'; document: TextData }
  | { kind: 'series'; seriesKey: string; seriesTitle: string; chapters: TextData[] }

export interface FilteredTextEntry {
  entry: TextIndexEntry
  matchedChapterIds: number[]
  autoExpand: boolean
}

export function getAuthorPerson(document: TextData): Person | undefined {
  if (document.authorPersonId == null) return undefined
  return mockPersons.find((p) => p.person_id === document.authorPersonId)
}

export function getSeriesRepresentative(chapters: TextData[]): TextData {
  return chapters.find((c) => c.series_order === 1) ?? chapters[0]
}

export function groupTexts(documents: TextData[]): TextIndexEntry[] {
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
      seriesTitle: document.series_title ?? document.title,
      chapters: [document],
    }
    seriesByKey.set(document.series_key, series)
    entries.push(series)
  }

  for (const entry of entries) {
    if (entry.kind === 'series') {
      entry.chapters.sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0))
    }
  }

  return entries
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
