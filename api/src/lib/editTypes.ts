import type { Database } from 'sql.js'
import { personExists } from './queries/photoTagTargets'
import {
  getEditableGallery,
  getEditableImage,
  getEditableSeries,
  listEditableGalleries,
  listEditableImages,
  listEditableSeries,
  listHiddenImages,
} from './queries/recordEditTargets'
import {
  getEditableTextDetail,
  listEditableTexts,
  listHiddenTexts,
} from './queries/textEditTargets'
import type { EditStatus } from './edits'
import { planRecordEdits, type FieldSpec } from './recordEditPlan'
import { planTextEdits, type FieldValue, type PlannedEdit } from './textEditPlan'

// The kinds of record the staged-edit routes accept, and for each one how
// to name it, find it in the snapshot, and turn a submitted form into
// edits. Adding a kind is an entry here, not a new route or table.

export type RecordId = number | string

export interface EditPlan {
  put: PlannedEdit[]
  clear: string[]
}

export interface EditType {
  // The id as it appears in a URL, or null if it can't be one of these.
  parseId(raw: string): RecordId | null
  // Every record of this kind an admin may edit, as the archive has it
  // now: what the editing page shows as "before".
  list(db: Database): unknown[]
  // The hidden ones -- unpublished texts and photographs -- for the list
  // an admin brings one back from. Absent for kinds that can't be hidden.
  listHidden?(db: Database): unknown[]
  // One record in full -- for a text, with its body, which the list
  // leaves out. null if it isn't one an admin may edit.
  get(db: Database, id: RecordId): unknown
  // Plans one record's changes, or explains why they can't be saved. The
  // snapshot is open read-only, to refuse an edit naming something that
  // doesn't exist -- the quiet kind of mistake that would otherwise only
  // surface when the edits are applied.
  plan(
    db: Database,
    id: RecordId,
    changes: unknown,
    status: EditStatus,
  ): EditPlan | { error: string; status: 400 | 404 }
}

function positiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

const document: EditType = {
  parseId: positiveInt,
  list: (db) => listEditableTexts(db),
  listHidden: (db) => listHiddenTexts(db),
  get: (db, id) => getEditableTextDetail(db, id as number),
  plan(db, id, changes, status) {
    const text = getEditableTextDetail(db, id as number)
    if (!text) return { error: `No text ${id}`, status: 404 }
    const plan = planTextEdits(text, changes, status)
    if ('error' in plan) return { error: plan.error, status: 400 }
    const missing = plan.personIds.filter((personId) => !personExists(db, personId))
    if (missing.length > 0) {
      return { error: `No person ${missing.join(', ')}`, status: 404 }
    }
    return { put: plan.put, clear: plan.clear }
  },
}

// A kind whose fields are all plain values: one spec, and the generic
// planner does the rest. The limits sit well above the longest values in
// the archive (a caption of 884 characters, a blurb of 756); they guard
// against a paste into the wrong box, not against a long caption.
function plainRecord<T>(
  label: string,
  parseId: (raw: string) => RecordId | null,
  list: (db: Database) => T[],
  get: (db: Database, id: RecordId) => T | null,
  spec: Record<string, FieldSpec>,
  listHidden?: (db: Database) => T[],
): EditType {
  return {
    parseId,
    list,
    listHidden,
    get,
    plan(db, id, changes) {
      const record = get(db, id)
      if (!record) return { error: `No ${label} ${id}`, status: 404 }
      const plan = planRecordEdits(record as Record<string, FieldValue>, changes, spec)
      return 'error' in plan ? { error: plan.error, status: 400 } : plan
    },
  }
}

const image = plainRecord(
  'photograph',
  positiveInt,
  listEditableImages,
  (db, id) => getEditableImage(db, id as number),
  {
    title: { kind: 'line', max: 300 },
    caption: { kind: 'text', max: 4000 },
    credit: { kind: 'line', max: 300 },
    year_taken: { kind: 'year' },
    location: { kind: 'line', max: 300 },
    is_published: { kind: 'flag' },
  },
  listHiddenImages,
)

const gallery = plainRecord(
  'gallery',
  positiveInt,
  listEditableGalleries,
  (db, id) => getEditableGallery(db, id as number),
  {
    name: { kind: 'line', max: 200, required: true },
    summary: { kind: 'text', max: 8000 },
  },
)

// Collections are keyed by their series_key, a word like "FredKnief".
const series = plainRecord(
  'collection',
  (raw) => (/^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : null),
  listEditableSeries,
  (db, id) => getEditableSeries(db, String(id)),
  {
    name: { kind: 'line', max: 200, required: true },
    blurb: { kind: 'text', max: 8000 },
  },
)

export const EDIT_TYPES: Record<string, EditType> = { document, image, gallery, series }
