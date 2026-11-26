import type { PendingEdit, RecordValue } from '../../utils/recordEditorState'
import { apiFetch } from './apiClient'

// Staged edits to photographs, galleries and collections: the same queue
// as the text edits (see textEdits.ts and api/CLAUDE.md's "Staged
// edits"), for records whose fields are plain values. They reach the
// archive through scripts/reviewEdits.ts.

export type RecordType = 'image' | 'gallery' | 'series'

interface QueuedEdit extends PendingEdit {
  entity: string
  was: RecordValue
}

export type EditableRecord = Record<string, RecordValue>

export async function getRecordForEditing(
  type: RecordType,
  id: string,
): Promise<{ record: EditableRecord; edits: PendingEdit[] }> {
  const { targets, edits } = await apiFetch<{
    targets: EditableRecord[]
    edits: QueuedEdit[]
  }>(`/edits?type=${type}&id=${encodeURIComponent(id)}`)
  return { record: targets[0], edits }
}

// Resolves to the record's pending edits as stored after the save.
export async function saveRecordEdits(
  type: RecordType,
  id: string,
  changes: Record<string, string>,
  status: 'draft' | 'submitted',
): Promise<PendingEdit[]> {
  const { edits } = await apiFetch<{ edits: QueuedEdit[] }>(
    `/edits/${type}/${encodeURIComponent(id)}`,
    { method: 'POST', body: { changes, status } },
  )
  return edits
}
