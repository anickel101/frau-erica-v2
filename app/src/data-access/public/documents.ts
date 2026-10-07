import documentsListRaw from '../../data/generated/documents-list.json'

// Listing documents. Reading one lives in ./documentDetail.
//
// Keep this module's imports to documents-list.json (83 KB) alone. The
// full bodies (documents.json, 1.2 MB) and images.json (203 KB) used to
// be imported here too, which meant every page touching any function in
// this file shipped all three -- the Index of Texts paid 1.4 MB to
// render a list of titles. See documentDetail.ts for the full reasoning.
// A static import cannot be tree-shaken away by what a caller actually
// uses, so the separation is the only thing holding that fix in place.

export type DocumentLanguage = 'en' | 'de'

export interface DocumentListItem {
  document_id: number
  series_key: string | null
  series_title: string | null
  series_order: number | null
  title: string
  author: string | null
  authorPersonId: number | null
  summary: string | null
  genre:
    'Biography' | 'Memoir' | 'History' | 'Literary' | 'Letter' | 'Recipe' | 'Other' | null
  tags: string | null
  // Which language this document's own content is in, for the handful
  // of works the archive holds in both. null for everything else, which
  // is most of it -- see schema.sql's note under Documents.
  language: DocumentLanguage | null
}

const documentsList = documentsListRaw as DocumentListItem[]

export function listDocuments(): DocumentListItem[] {
  return documentsList
}

// Both halves of a parallel text resolve to the same page: ask for
// either id and you get the entry point -- the row carrying the title
// and summary the archive lists -- with its counterpart alongside. A
// reader who lands on the German half's URL gets the pair rather than
// an untitled German page with no way back.
//
// Exported and generic over the row shape so it can be tested directly
// rather than through the generated JSON module. (This used to say no
// document was split yet; 17 are, and both halves of every pair are
// published -- so the generic signature is now a testing convenience
// rather than a necessity.)
export function resolveDocumentPair<
  T extends { document_id: number; parallel_of: number | null },
>(all: T[], id: number): { entry: T; counterpart: T | undefined } | undefined {
  const asked = all.find((d) => d.document_id === id)
  if (!asked) return undefined

  // If the id names a translated half, the entry point is what it
  // points at; otherwise it IS the entry point, and its counterpart is
  // whatever points back at it. The ?? asked fallback covers a
  // dangling pointer -- better a lone German page than none at all.
  const entry =
    asked.parallel_of !== null
      ? (all.find((d) => d.document_id === asked.parallel_of) ?? asked)
      : asked
  const counterpart =
    entry === asked ? all.find((d) => d.parallel_of === entry.document_id) : asked

  return { entry, counterpart }
}

export function getSeriesChapters(seriesKey: string): DocumentListItem[] {
  return documentsList
    .filter((d) => d.series_key === seriesKey)
    .sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0))
}
