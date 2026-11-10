import { GENRES, type EditableText } from './queries/textEditTargets'

// Turns what the editor submitted for one text into the pending edits to
// store and the ones to clear.
//
// The page sends a field's whole new value, not a diff. Anything that
// matches what the archive already holds clears that field's pending edit
// rather than storing a change to the same value -- which is also how an
// edit is withdrawn: send the archive's value back.
//
// Pure, so every rule here is tested without DynamoDB or an event.

export const AUTHOR_MAX = 200
// The longest summary in the archive is under 1,000 characters. This is a
// guard against a paste of the whole text into the wrong box, not a style
// rule.
export const SUMMARY_MAX = 4000
export const PEOPLE_MAX = 50

export type FieldValue = string | number | boolean | null

export interface PlannedEdit {
  field: string
  value: FieldValue
  was: FieldValue
}

export interface TextEditPlan {
  put: PlannedEdit[]
  clear: string[]
  // Persons the edit points at, which the caller must confirm exist. Not
  // checked here, so this stays free of the database.
  personIds: number[]
}

const FIELDS = ['author', 'author_person_id', 'genre', 'summary', 'people'] as const

export function linkField(personId: number): string {
  return `person#${personId}`
}

// Trimmed, with Windows line endings folded, and empty meaning "none".
// A textarea submits \r\n on some browsers, and a summary that differs
// from the archive only in its line endings is not an edit.
function cleanText(value: string | null): string | null {
  if (value === null) return null
  const cleaned = value.replace(/\r\n?/g, '\n').trim()
  return cleaned === '' ? null : cleaned
}

function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function planTextEdits(
  text: EditableText,
  body: unknown,
): TextEditPlan | { error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Expected an object of fields' }
  }
  const input = body as Record<string, unknown>

  // An unknown field is refused rather than ignored: a typo ("auther")
  // would otherwise save nothing and report success.
  const unknown = Object.keys(input).filter(
    (key) => !(FIELDS as readonly string[]).includes(key),
  )
  if (unknown.length > 0) return { error: `Unknown field: ${unknown.join(', ')}` }

  const plan: TextEditPlan = { put: [], clear: [], personIds: [] }
  const propose = (field: string, value: FieldValue, was: FieldValue, same: boolean) => {
    if (same) plan.clear.push(field)
    else plan.put.push({ field, value, was })
  }

  if ('author' in input) {
    if (input.author !== null && typeof input.author !== 'string') {
      return { error: 'author must be text or null' }
    }
    const author = cleanText(input.author)
    if (author !== null && author.length > AUTHOR_MAX) {
      return { error: `author must be at most ${AUTHOR_MAX} characters` }
    }
    propose('author', author, text.author, author === cleanText(text.author))
  }

  if ('author_person_id' in input) {
    const id = input.author_person_id
    if (id !== null && !isPositiveId(id)) {
      return { error: 'author_person_id must be a person id or null' }
    }
    if (id !== null) plan.personIds.push(id)
    propose('author_person_id', id, text.author_person_id, id === text.author_person_id)
  }

  if ('genre' in input) {
    const genre = input.genre
    if (typeof genre !== 'string' || !(GENRES as readonly string[]).includes(genre)) {
      return { error: `genre must be one of ${GENRES.join(', ')}` }
    }
    propose('genre', genre, text.genre, genre === text.genre)
  }

  if ('summary' in input) {
    if (input.summary !== null && typeof input.summary !== 'string') {
      return { error: 'summary must be text or null' }
    }
    const summary = cleanText(input.summary)
    if (summary !== null && summary.length > SUMMARY_MAX) {
      return { error: `summary must be at most ${SUMMARY_MAX} characters` }
    }
    propose('summary', summary, text.summary, summary === cleanText(text.summary))
  }

  if ('people' in input) {
    const people = input.people
    if (typeof people !== 'object' || people === null || Array.isArray(people)) {
      return { error: 'people must map person ids to true (link) or false (unlink)' }
    }
    const entries = Object.entries(people as Record<string, unknown>)
    if (entries.length > PEOPLE_MAX) {
      return { error: `At most ${PEOPLE_MAX} people per save` }
    }
    for (const [key, linked] of entries) {
      const id = /^\d+$/.test(key) ? Number(key) : NaN
      if (!isPositiveId(id) || typeof linked !== 'boolean') {
        return { error: 'people must map person ids to true (link) or false (unlink)' }
      }
      const isLinked = text.person_ids.includes(id)
      if (linked) plan.personIds.push(id)
      propose(linkField(id), linked, isLinked, linked === isLinked)
    }
  }

  if (plan.put.length === 0 && plan.clear.length === 0) {
    return { error: 'Nothing to save' }
  }
  return plan
}
