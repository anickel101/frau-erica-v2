import type { Database } from 'sql.js'
import { personExists } from './queries/photoTagTargets'
import { getEditableTextDetail, listEditableTexts } from './queries/textEditTargets'
import { planTextEdits, type PlannedEdit } from './textEditPlan'

// The kinds of record the staged-edit routes accept, and for each one how
// to find it in the snapshot and how to turn a submitted form into edits.
// Adding a kind -- photographs, galleries -- is an entry here, not a new
// route or table.

export interface EditPlan {
  put: PlannedEdit[]
  clear: string[]
}

export interface EditType {
  // Every record of this kind an admin may edit, as the archive has it
  // now: what the editing page shows as "before".
  list(db: Database): unknown[]
  // One record in full -- for a text, with its body, which the list
  // leaves out. null if it isn't one an admin may edit.
  get(db: Database, id: number): unknown
  // Plans one record's changes, or explains why they can't be saved. The
  // snapshot is open read-only, to refuse an edit naming something that
  // doesn't exist -- the quiet kind of mistake that would otherwise only
  // surface when the edits are applied.
  plan(
    db: Database,
    id: number,
    changes: unknown,
  ): EditPlan | { error: string; status: 400 | 404 }
}

const document: EditType = {
  list: (db) => listEditableTexts(db),
  get: (db, id) => getEditableTextDetail(db, id),
  plan(db, id, changes) {
    const text = getEditableTextDetail(db, id)
    if (!text) return { error: `No published text ${id}`, status: 404 }
    const plan = planTextEdits(text, changes)
    if ('error' in plan) return { error: plan.error, status: 400 }
    const missing = plan.personIds.filter((personId) => !personExists(db, personId))
    if (missing.length > 0) {
      return { error: `No person ${missing.join(', ')}`, status: 404 }
    }
    return { put: plan.put, clear: plan.clear }
  },
}

export const EDIT_TYPES: Record<string, EditType> = { document }
