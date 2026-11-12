// Documents.genre's CHECK constraint, in schema order -- the one list of
// text genres in app/. The API keeps its own copy, pinned to schema.sql
// by a test (api/src/lib/queries/textEditTargets.test.ts).
//
// Its own module, not in data-access/public/documents.ts, because that
// file imports documents-list.json and anything importing it pays for
// the list; the admin tagging page wants these eight words, not 83 KB.
//
// There were two lists before this one: documents.ts's type had never
// been told about 'Obituary' (migration 005), which an `as` cast on the
// JSON hid from the compiler.
export const GENRES = [
  'Biography',
  'Memoir',
  'History',
  'Literary',
  'Letter',
  'Recipe',
  'Obituary',
  'Other',
] as const

export type Genre = (typeof GENRES)[number]
