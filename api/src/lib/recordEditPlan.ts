import { cleanText, type FieldValue, type PlannedEdit } from './textEditPlan'

// The planner for records whose editable fields are all plain values --
// a photograph's caption, a gallery's summary, a collection's blurb.
// Each kind describes its fields once (a spec) and this does the rest,
// with the same rules as the text planner: the page sends a field's whole
// new value; one matching the archive withdraws that field's pending edit;
// an unknown field is refused rather than ignored.
//
// Pure, so every rule is tested without DynamoDB or an event.

export type FieldSpec =
  // One line: a title, a name, a credit.
  | { kind: 'line'; max: number; required?: boolean }
  // Markdown that may run to paragraphs: a caption, a summary, a blurb.
  | { kind: 'text'; max: number; required?: boolean }
  // A whole year, or nothing.
  | { kind: 'year' }

export interface RecordEditPlan {
  put: PlannedEdit[]
  clear: string[]
}

const YEAR_MIN = 1700
const YEAR_MAX = 2100

export function planRecordEdits(
  current: Record<string, FieldValue>,
  body: unknown,
  spec: Record<string, FieldSpec>,
): RecordEditPlan | { error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Expected an object of fields' }
  }
  const input = body as Record<string, unknown>
  const unknown = Object.keys(input).filter((key) => !Object.hasOwn(spec, key))
  if (unknown.length > 0) return { error: `Unknown field: ${unknown.join(', ')}` }

  const plan: RecordEditPlan = { put: [], clear: [] }
  for (const [field, rule] of Object.entries(spec)) {
    if (!(field in input)) continue
    const raw = input[field]
    const was = current[field] ?? null
    let value: FieldValue

    if (rule.kind === 'year') {
      if (raw === null || raw === '') value = null
      else {
        const year =
          typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw) : raw
        if (
          !Number.isInteger(year) ||
          (year as number) < YEAR_MIN ||
          (year as number) > YEAR_MAX
        ) {
          return { error: `${field} must be a year between ${YEAR_MIN} and ${YEAR_MAX}` }
        }
        value = year as number
      }
      if (value === was) plan.clear.push(field)
      else plan.put.push({ field, value, was })
      continue
    }

    if (raw !== null && typeof raw !== 'string') return { error: `${field} must be text` }
    const text = cleanText(raw as string | null)
    if (text === null && rule.required) return { error: `${field} can't be empty` }
    if (text !== null && rule.kind === 'line' && text.includes('\n')) {
      return { error: `${field} must be a single line` }
    }
    if (text !== null && text.length > rule.max) {
      return { error: `${field} must be at most ${rule.max} characters` }
    }
    const same = text === cleanText(typeof was === 'string' ? was : null)
    if (same) plan.clear.push(field)
    else plan.put.push({ field, value: text, was })
  }

  if (plan.put.length === 0 && plan.clear.length === 0)
    return { error: 'Nothing to save' }
  return plan
}
