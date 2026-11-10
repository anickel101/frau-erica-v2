import type { Database } from 'sql.js'
import { queryAll } from '../sqlHelpers'

// What the archive currently says about each text the tagging page can
// edit, read from the snapshot.
//
// "Text" here means a published WORK: a document with no parallel_of.
// The German half of a bilingual pair is a satellite of its English
// entry point -- the export keeps it out of every list for the same
// reason -- so it is edited through that entry point, and the apply
// script carries the byline and genre across to it.

// Documents.genre's CHECK constraint, in the same order. A test reads it
// back out of schema.sql, so the two cannot drift: a genre accepted here
// and refused by the archive would only fail at apply time, weeks later.
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

export interface EditableText {
  document_id: number
  title: string
  series_key: string | null
  series_title: string | null
  series_order: number | null
  author: string | null
  author_person_id: number | null
  genre: string | null
  summary: string | null
  // The old site's free-text subject tags ("Schumm, Adelheid"), shown to
  // the editor as a hint. Never matched to a person automatically -- 97
  // first-and-last-name pairs in this archive belong to two or more
  // people.
  tags: string | null
  // Everyone DocumentLinks connects to this work, on either half of a
  // bilingual pair. 65 of the existing links sit on a German half, so
  // reading the entry point alone would show those texts as unlinked.
  person_ids: number[]
}

type TextRow = Omit<EditableText, 'person_ids'>

const TEXT_COLUMNS = `document_id, title, series_key, series_title, series_order,
                      author, author_person_id, genre, summary, tags`

function attachLinks(db: Database, rows: TextRow[]): EditableText[] {
  const links = queryAll<{ work_id: number; person_id: number }>(
    db,
    `SELECT DISTINCT COALESCE(d.parallel_of, d.document_id) AS work_id, dl.person_id
       FROM DocumentLinks dl
       JOIN Documents d ON d.document_id = dl.document_id
      WHERE dl.person_id IS NOT NULL
      ORDER BY dl.person_id`,
  )
  const byWork = new Map<number, number[]>()
  for (const { work_id, person_id } of links) {
    byWork.set(work_id, [...(byWork.get(work_id) ?? []), person_id])
  }
  return rows.map((row) => ({ ...row, person_ids: byWork.get(row.document_id) ?? [] }))
}

export function listEditableTexts(db: Database): EditableText[] {
  const rows = queryAll<TextRow>(
    db,
    `SELECT ${TEXT_COLUMNS} FROM Documents
      WHERE is_published = 1 AND parallel_of IS NULL
      ORDER BY document_id`,
  )
  return attachLinks(db, rows)
}

// null for anything the page should not be editing: an unpublished
// document, a German half, or an id nobody has.
export function getEditableText(db: Database, documentId: number): EditableText | null {
  const rows = queryAll<TextRow>(
    db,
    `SELECT ${TEXT_COLUMNS} FROM Documents
      WHERE document_id = :id AND is_published = 1 AND parallel_of IS NULL`,
    { ':id': documentId },
  )
  return rows.length === 1 ? attachLinks(db, rows)[0] : null
}
