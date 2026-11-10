import { apiFetch } from './apiClient'

// Proposed changes to texts' catalogue fields -- byline, author record,
// genre, summary, and the people a text is linked to.
//
// Like photo tags, these live in their own store and never in the
// archive: see api/CLAUDE.md's "Text tagging". They reach Documents and
// DocumentLinks later, through scripts/reviewTextEdits.ts.

// A published text as the archive (the API's snapshot of it) currently
// has it.
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
  // The old site's free-text subject tags, e.g. "Schumm, Adelheid".
  tags: string | null
  person_ids: number[]
}

// field is 'author', 'author_person_id', 'genre', 'summary', or
// 'person#<id>' with value true (link) or false (unlink).
export interface TextEdit {
  document_id: number
  field: string
  value: string | number | boolean | null
  was: string | number | boolean | null
  edited_by: string
  edited_at: string
}

// What the page sends for one text: each field's whole new value, and
// for people, true to link and false to unlink. A value matching the
// archive withdraws that field's pending edit.
export interface TextEditChanges {
  author?: string | null
  author_person_id?: number | null
  genre?: string
  summary?: string | null
  people?: Record<number, boolean>
}

export function listTextEdits(): Promise<{ texts: EditableText[]; edits: TextEdit[] }> {
  return apiFetch('/text-edits')
}

// Resolves to the text's pending edits as stored after the save.
export async function saveTextEdits(
  documentId: number,
  changes: TextEditChanges,
): Promise<TextEdit[]> {
  const { edits } = await apiFetch<{ edits: TextEdit[] }>(`/text-edits/${documentId}`, {
    method: 'POST',
    body: changes,
  })
  return edits
}
