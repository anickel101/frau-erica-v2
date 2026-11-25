import type {
  EditableTextDetail,
  TextEdit,
  TextEditChanges,
} from '../data-access/gated/textEdits'

// The bookkeeping behind the admin text editor, kept out of the page so
// it can be tested: what the form opens with, what each kind of save
// sends, and the small text surgery the toolbar does.

export const EDITOR_FIELDS = ['title', 'summary', 'content'] as const
export type EditorField = (typeof EDITOR_FIELDS)[number]
export type EditorValues = Record<EditorField, string>

// The archive's own values. An absent summary is an empty box; the API
// stores an empty one as "none".
export function archiveValues(text: EditableTextDetail): EditorValues {
  return { title: text.title, summary: text.summary ?? '', content: text.content }
}

// What the form opens with: the archive, with any pending edit -- a draft
// or a submitted one, by anyone -- laid over it. Drafts are shared between
// admins, so whoever opens the text picks up where the last one left off.
export function openingValues(text: EditableTextDetail, edits: TextEdit[]): EditorValues {
  const values = archiveValues(text)
  for (const edit of edits) {
    if ((EDITOR_FIELDS as readonly string[]).includes(edit.field)) {
      values[edit.field as EditorField] = (edit.value as string | null) ?? ''
    }
  }
  return values
}

export function pendingEditorEdits(edits: TextEdit[]): TextEdit[] {
  return edits.filter((e) => (EDITOR_FIELDS as readonly string[]).includes(e.field))
}

// A bilingual text's body is refused by the API until the side-by-side
// editor exists, so it is never sent.
function editable(field: EditorField, bilingual: boolean): boolean {
  return !(field === 'content' && bilingual)
}

// Fields that differ between two states of the form: what an autosave
// sends, measured from the last thing it saved. Only those -- saving the
// body as a draft must not demote a summary someone else has submitted.
export function changedFields(
  from: EditorValues,
  to: EditorValues,
  bilingual: boolean,
): TextEditChanges {
  const changes: TextEditChanges = {}
  for (const field of EDITOR_FIELDS) {
    if (editable(field, bilingual) && from[field] !== to[field])
      changes[field] = to[field]
  }
  return changes
}

// What Submit sends: every field that differs from the archive or already
// has a pending edit, all marked submitted. A field brought back to the
// archive's value goes too, so its pending edit is withdrawn.
export function submitChanges(
  text: EditableTextDetail,
  values: EditorValues,
  edits: TextEdit[],
): TextEditChanges {
  const archive = archiveValues(text)
  const pending = new Set(pendingEditorEdits(edits).map((e) => e.field))
  const changes: TextEditChanges = {}
  for (const field of EDITOR_FIELDS) {
    if (!editable(field, text.bilingual)) continue
    if (values[field] !== archive[field] || pending.has(field))
      changes[field] = values[field]
  }
  return changes
}

// What Discard sends: the archive's own value for every field with a
// pending edit, which withdraws them -- whoever made them.
export function discardChanges(
  text: EditableTextDetail,
  edits: TextEdit[],
): TextEditChanges {
  const archive = archiveValues(text)
  const changes: TextEditChanges = {}
  for (const edit of pendingEditorEdits(edits)) {
    const field = edit.field as EditorField
    if (editable(field, text.bilingual)) changes[field] = archive[field]
  }
  return changes
}

export function hasChanges(changes: TextEditChanges): boolean {
  return Object.keys(changes).length > 0
}

// ---------------------------------------------------------------- toolbar

export interface Edited {
  value: string
  selectionStart: number
  selectionEnd: number
}

// Bold, italic: wrap the selection in a marker, or insert a placeholder
// word ready to type over when nothing is selected.
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string,
): Edited {
  const selected = value.slice(start, end) || placeholder
  const next = value.slice(0, start) + marker + selected + marker + value.slice(end)
  return {
    value: next,
    selectionStart: start + marker.length,
    selectionEnd: start + marker.length + selected.length,
  }
}

// A link: the selection becomes the link's words, with the address left
// selected so it can be typed straight over.
export function insertLink(value: string, start: number, end: number): Edited {
  const words = value.slice(start, end) || 'link text'
  const address = 'https://'
  const inserted = `[${words}](${address})`
  const addressStart = start + words.length + 3
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    selectionStart: addressStart,
    selectionEnd: addressStart + address.length,
  }
}

// A photograph goes in as its own paragraph: on a line of its own with a
// blank line either side, however the cursor was placed. Glued to a
// sentence it would float mid-paragraph instead.
export function insertBlock(value: string, position: number, block: string): Edited {
  const before = value.slice(0, position).replace(/[ \t]+$/, '')
  const after = value.slice(position).replace(/^[ \t]+/, '')
  const lead =
    before === ''
      ? ''
      : before.endsWith('\n\n')
        ? ''
        : before.endsWith('\n')
          ? '\n'
          : '\n\n'
  const trail =
    after === ''
      ? ''
      : after.startsWith('\n\n')
        ? ''
        : after.startsWith('\n')
          ? '\n'
          : '\n\n'
  const next = before + lead + block + trail + after
  const caret = before.length + lead.length + block.length
  return { value: next, selectionStart: caret, selectionEnd: caret }
}

// ------------------------------------------------------------ photo search

export interface SearchableImage {
  image_id: number
  title: string | null
  caption: string | null
  url: string
}

// Every word typed must appear somewhere in the photograph's title,
// caption or file name -- "joel chicago" finds Joel in Chicago -- or the
// query is its id.
export function searchImages<T extends SearchableImage>(
  images: T[],
  query: string,
  limit = 60,
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return images.slice(0, limit)
  if (words.length === 1 && /^\d+$/.test(words[0])) {
    return images.filter((img) => img.image_id === Number(words[0]))
  }
  return images
    .filter((img) => {
      const haystack = `${img.title ?? ''} ${img.caption ?? ''} ${img.url}`.toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
    .slice(0, limit)
}
