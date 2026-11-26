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
  // Whether visitors can see it. The Tag texts list only ever holds
  // published texts; one opened in the editor may be hidden, which is how
  // a hidden text is brought back.
  is_published: boolean
}

type TextRow = Omit<EditableText, 'person_ids' | 'is_published'> & {
  is_published: number
}

const TEXT_COLUMNS = `document_id, title, series_key, series_title, series_order,
                      author, author_person_id, genre, summary, tags, is_published`

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
  return rows.map((row) => ({
    ...row,
    is_published: row.is_published === 1,
    person_ids: byWork.get(row.document_id) ?? [],
  }))
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

// Every hidden work -- unpublished, and not a German half -- for the admin
// list that brings one back. Title and collection are all that list
// shows; the editor fetches the rest.
export function listHiddenTexts(db: Database): EditableText[] {
  const rows = queryAll<TextRow>(
    db,
    `SELECT ${TEXT_COLUMNS} FROM Documents
      WHERE is_published = 0 AND parallel_of IS NULL
      ORDER BY title`,
  )
  return attachLinks(db, rows)
}

// null for a German half (edited through its entry point) or an id nobody
// has. A hidden text is editable: that is how it is brought back.
export function getEditableText(db: Database, documentId: number): EditableText | null {
  const rows = queryAll<TextRow>(
    db,
    `SELECT ${TEXT_COLUMNS} FROM Documents
      WHERE document_id = :id AND parallel_of IS NULL`,
    { ':id': documentId },
  )
  return rows.length === 1 ? attachLinks(db, rows)[0] : null
}

// One text with what the full editor needs on top: its body, and whether
// a German half sits alongside it. Kept out of listEditableTexts, which
// serves every text at once -- the bodies run to 1.2 MB between them.
export interface EditableTextDetail extends EditableText {
  // As stored, {{image:ID}} placeholders and all.
  content: string
  // True when a German half points at this text; its body is then
  // edited paragraph by paragraph beside content_de.
  bilingual: boolean
  // The German half's body, as stored, or null for an English-only text.
  // Edited through this, the entry point, as the field "content_de":
  // the German half is never a record of its own in the queue.
  content_de: string | null
}

export function getEditableTextDetail(
  db: Database,
  documentId: number,
): EditableTextDetail | null {
  const text = getEditableText(db, documentId)
  if (!text) return null
  const [row] = queryAll<{ content: string | null }>(
    db,
    'SELECT content FROM Documents WHERE document_id = :id',
    { ':id': documentId },
  )
  // The export allows one German half per text; more than one is an
  // archive error it refuses to publish, so the first is as good as any.
  const [german] = queryAll<{ content: string | null }>(
    db,
    'SELECT content FROM Documents WHERE parallel_of = :id ORDER BY document_id LIMIT 1',
    { ':id': documentId },
  )
  return {
    ...text,
    content: row.content ?? '',
    bilingual: german !== undefined,
    content_de: german ? (german.content ?? '') : null,
  }
}
