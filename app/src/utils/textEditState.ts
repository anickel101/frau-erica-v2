import type {
  EditableText,
  TextEdit,
  TextEditChanges,
} from '../data-access/gated/textEdits'

// The bookkeeping behind the text-tagging page, kept out of the
// component so it can be tested: what a text looks like once its
// pending edits are laid over the archive, which texts a filter keeps,
// and what to send when the editor saves.

// Documents.genre's CHECK constraint, in schema order. The API holds the
// authoritative copy (and a test pinning it to schema.sql); a genre
// missing here only means it can't be picked, never a bad save.
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

export interface TextValues {
  author: string | null
  author_person_id: number | null
  genre: string | null
  summary: string | null
  person_ids: number[]
}

export const LINK_PREFIX = 'person#'

// The text as it will read once its pending edits are applied -- which is
// what the editor shows and what the filters judge, since a text whose
// missing author is waiting in the queue is no longer missing one.
export function withPending(text: EditableText, edits: TextEdit[]): TextValues {
  const values: TextValues = {
    author: text.author,
    author_person_id: text.author_person_id,
    genre: text.genre,
    summary: text.summary,
    person_ids: [...text.person_ids],
  }
  for (const edit of edits) {
    if (edit.document_id !== text.document_id) continue
    if (edit.field.startsWith(LINK_PREFIX)) {
      const id = Number(edit.field.slice(LINK_PREFIX.length))
      values.person_ids = values.person_ids.filter((p) => p !== id)
      if (edit.value === true) values.person_ids.push(id)
    } else if (edit.field === 'author_person_id') {
      values.author_person_id = edit.value as number | null
    } else if (
      edit.field === 'author' ||
      edit.field === 'genre' ||
      edit.field === 'summary'
    ) {
      values[edit.field] = edit.value as string | null
    }
  }
  return values
}

// What changed between the form as it opened and as it is now. Only
// those fields are sent, so saving one field never re-proposes another
// that someone else changed in the meantime.
export function changesBetween(before: TextValues, after: TextValues): TextEditChanges {
  const changes: TextEditChanges = {}
  if ((after.author ?? '') !== (before.author ?? '')) changes.author = after.author
  if (after.author_person_id !== before.author_person_id) {
    changes.author_person_id = after.author_person_id
  }
  if (after.genre !== before.genre && after.genre !== null) changes.genre = after.genre
  if ((after.summary ?? '') !== (before.summary ?? '')) changes.summary = after.summary

  const people: Record<number, boolean> = {}
  for (const id of after.person_ids)
    if (!before.person_ids.includes(id)) people[id] = true
  for (const id of before.person_ids)
    if (!after.person_ids.includes(id)) people[id] = false
  if (Object.keys(people).length > 0) changes.people = people

  return changes
}

export type TextFilter = 'all' | 'no-author' | 'other' | 'unlinked' | 'pending'

export const FILTERS: { key: TextFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'no-author', label: 'No author' },
  { key: 'other', label: 'Genre "Other"' },
  { key: 'unlinked', label: 'Nobody linked' },
  { key: 'pending', label: 'Edited, not yet applied' },
]

export function isTextFilter(value: string | null): value is TextFilter {
  return FILTERS.some((f) => f.key === value)
}

export function matchesFilter(
  values: TextValues,
  hasPending: boolean,
  filter: TextFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'no-author':
      return !values.author && values.author_person_id === null
    case 'other':
      return values.genre === 'Other' || values.genre === null
    case 'unlinked':
      return values.person_ids.length === 0
    case 'pending':
      return hasPending
  }
}

// The old site's subject tags -- "Mueller/Knief, Dora Elizabeth (Dodo);
// Knief, Friedrich Constantinus (Fred)" -- each turned into a search the
// person picker can run. Never resolved to a person here: 97 name pairs
// in the archive belong to two or more people, so the editor chooses.
//
// The search is given name plus first surname ("Dora Mueller"), because
// the person search matches every word typed and a record holds one
// surname; a married one ("Knief") is found through the API's aliases.
export function legacyTagSearches(
  tags: string | null,
): { label: string; query: string }[] {
  if (!tags) return []
  return tags
    .split(';')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((label) => {
      const plain = label.replace(/\([^)]*\)/g, '').trim()
      const match = plain.match(/^([^,]+),\s*(.+)$/)
      if (!match) return { label, query: plain }
      const surname = match[1].split('/')[0].trim()
      const given = match[2].trim().split(/\s+/)[0]
      return { label, query: `${given} ${surname}` }
    })
}

export interface TextGroup {
  key: string
  name: string
  texts: EditableText[]
}

// Collections first, alphabetically, each in reading order; then every
// text that belongs to none. The same order the editor's Previous and
// Next walk, so working through a collection goes chapter by chapter.
export function groupTexts(
  texts: EditableText[],
  collectionName: (seriesKey: string) => string | undefined,
): TextGroup[] {
  const groups = new Map<string, TextGroup>()
  const single: EditableText[] = []
  for (const text of texts) {
    if (!text.series_key) {
      single.push(text)
      continue
    }
    const group = groups.get(text.series_key) ?? {
      key: text.series_key,
      name: collectionName(text.series_key) ?? text.series_title ?? text.series_key,
      texts: [],
    }
    group.texts.push(text)
    groups.set(text.series_key, group)
  }

  const collections = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
  for (const group of collections) {
    group.texts.sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0))
  }
  single.sort((a, b) => a.title.localeCompare(b.title))
  return single.length > 0
    ? [...collections, { key: '', name: 'Texts in no collection', texts: single }]
    : collections
}
