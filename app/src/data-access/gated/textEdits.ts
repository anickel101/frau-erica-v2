import { apiFetch } from './apiClient'

// Proposed changes to texts -- byline, author record, genre, summary, and
// the people a text is linked to -- held in the API's staged-edits queue.
//
// Like photo tags, these live in their own store and never in the
// archive: see api/CLAUDE.md's "Staged edits". They reach Documents and
// DocumentLinks later, through scripts/reviewEdits.ts.
//
// The queue holds every kind of record, keyed "document#40"; this module
// is its text-shaped view, and hands the page plain document ids.

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

// One text in full, for the editor: its body as stored ({{image:ID}}
// placeholders and all), and whether a German half sits beside it, whose
// body can't be edited yet.
export interface EditableTextDetail extends EditableText {
  content: string
  bilingual: boolean
}

export type EditStatus = 'draft' | 'submitted'

// field is 'author', 'author_person_id', 'genre', 'summary', or
// 'person#<id>' with value true (link) or false (unlink).
export interface TextEdit {
  document_id: number
  field: string
  value: string | number | boolean | null
  was: string | number | boolean | null
  status: EditStatus
  edited_by: string
  edited_at: string
}

// What the page sends for one text: each field's whole new value, and
// for people, true to link and false to unlink. A value matching the
// archive withdraws that field's pending edit.
export interface TextEditChanges {
  title?: string
  content?: string
  author?: string | null
  author_person_id?: number | null
  genre?: string
  summary?: string | null
  people?: Record<number, boolean>
}

// The queue's own shape: entity "document#40" rather than a document id.
type QueuedEdit = Omit<TextEdit, 'document_id'> & { entity: string }

const ENTITY_PREFIX = 'document#'

export function toTextEdit({ entity, ...rest }: QueuedEdit): TextEdit {
  return { document_id: Number(entity.slice(ENTITY_PREFIX.length)), ...rest }
}

export async function listTextEdits(): Promise<{
  texts: EditableText[]
  edits: TextEdit[]
}> {
  const { targets, edits } = await apiFetch<{
    targets: EditableText[]
    edits: QueuedEdit[]
  }>('/edits?type=document')
  return { texts: targets, edits: edits.map(toTextEdit) }
}

// One text and its own pending edits, drafts included: what the editor
// opens with.
export async function getTextForEditing(
  documentId: number,
): Promise<{ text: EditableTextDetail; edits: TextEdit[] }> {
  const { targets, edits } = await apiFetch<{
    targets: EditableTextDetail[]
    edits: QueuedEdit[]
  }>(`/edits?type=document&id=${documentId}`)
  return { text: targets[0], edits: edits.map(toTextEdit) }
}

// Resolves to the text's pending edits as stored after the save. Saving
// on the tagging page submits straight away, as it always has; a draft is
// for longer work, like rewriting a text's body.
export async function saveTextEdits(
  documentId: number,
  changes: TextEditChanges,
  status: EditStatus = 'submitted',
): Promise<TextEdit[]> {
  const { edits } = await apiFetch<{ edits: QueuedEdit[] }>(
    `/edits/document/${documentId}`,
    { method: 'POST', body: { changes, status } },
  )
  return edits.map(toTextEdit)
}
