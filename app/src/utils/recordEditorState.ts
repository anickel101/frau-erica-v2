// The bookkeeping behind the admin editor for photographs, galleries and
// collections -- records whose editable fields are plain values. The
// same rules as the text editor's (utils/textEditorState.ts): what the
// form opens with, what an autosave sends, what Submit and Discard send.
//
// Every field is held as a string while editing, a year included; the
// API turns "" into none and "1962" into 1962.

export type RecordValue = string | number | boolean | null
export type FormValues = Record<string, string>

export interface PendingEdit {
  field: string
  value: RecordValue
  status: 'draft' | 'submitted'
  edited_by: string
  edited_at: string
}

function asText(value: RecordValue | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

export function archiveValues(
  record: Record<string, RecordValue>,
  fields: readonly string[],
): FormValues {
  return Object.fromEntries(fields.map((field) => [field, asText(record[field])]))
}

// The archive with every pending edit -- a draft or submitted, by anyone
// -- laid over it.
export function openingValues(
  record: Record<string, RecordValue>,
  fields: readonly string[],
  edits: PendingEdit[],
): FormValues {
  const values = archiveValues(record, fields)
  for (const edit of edits) {
    if (fields.includes(edit.field)) values[edit.field] = asText(edit.value)
  }
  return values
}

// What changed since the last save: all an autosave sends, so saving one
// field as a draft never demotes another that someone submitted.
export function changedFields(from: FormValues, to: FormValues): FormValues {
  return Object.fromEntries(
    Object.entries(to).filter(([field, value]) => from[field] !== value),
  )
}

// Submit: every field that differs from the archive or has a pending
// edit -- the latter so a field put back to the archive's value has its
// pending edit withdrawn.
export function submitChanges(
  archive: FormValues,
  values: FormValues,
  edits: PendingEdit[],
): FormValues {
  const pending = new Set(edits.map((e) => e.field))
  return Object.fromEntries(
    Object.entries(values).filter(
      ([field, value]) => value !== archive[field] || pending.has(field),
    ),
  )
}

// Discard: the archive's own value for every pending field, withdrawing
// them all, whoever made them.
export function discardChanges(archive: FormValues, edits: PendingEdit[]): FormValues {
  return Object.fromEntries(
    edits.filter((e) => e.field in archive).map((e) => [e.field, archive[e.field]]),
  )
}
