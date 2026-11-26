// The pure parts of reviewEdits.ts, kept apart so they can be tested
// without DynamoDB or the archive: how an edit is judged against the
// archive as it is now, the SQL each edit becomes, and the word diff that
// makes a long change readable in the report.

export type Value = string | number | boolean | null

export type Verdict = 'ready' | 'already applied' | 'conflict'

// An edit carries the value the archive held when it was made (was). If
// the archive already says what the edit wants, there is nothing to do;
// if it no longer says what it said then, someone changed it in the
// meantime and the edit is held back rather than written over that.
export function judge(value: Value, was: Value, now: Value): Verdict {
  if (now === value) return 'already applied'
  if (now !== was) return 'conflict'
  return 'ready'
}

export function sqlLiteral(value: Value): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${value.replace(/'/g, "''")}'`
}

export const LINK_PREFIX = 'person#'

// Fields of Documents an edit may set. The summary and the body are the
// entry point's own (a German half has its own body); the rest -- title
// included, 78 of 78 halves carrying their entry's -- are shared with a
// German half, if there is one, which the archive has always kept in
// agreement.
export const DOCUMENT_FIELDS = [
  'title',
  'content',
  // The German half's body. Edited through the entry point, so it lives
  // on the entry point's record in the queue, but written to the half.
  'content_de',
  'author',
  'author_person_id',
  'genre',
  'summary',
] as const
const ENTRY_POINT_ONLY = new Set(['summary', 'content'])

export function documentStatement(
  documentId: number,
  field: string,
  value: Value,
): string {
  if (field.startsWith(LINK_PREFIX)) {
    const personId = Number(field.slice(LINK_PREFIX.length))
    if (!Number.isSafeInteger(personId) || personId <= 0) {
      throw new Error(`bad link field ${field}`)
    }
    // An unlink removes the person from both halves: 65 links sit on a
    // German half, and "linked" means linked on either.
    return value === true
      ? `INSERT INTO DocumentLinks (document_id, person_id) VALUES (${documentId}, ${personId});`
      : `DELETE FROM DocumentLinks WHERE person_id = ${personId}\n` +
          `   AND (document_id = ${documentId} OR document_id IN ` +
          `(SELECT document_id FROM Documents WHERE parallel_of = ${documentId}));`
  }
  if (!(DOCUMENT_FIELDS as readonly string[]).includes(field)) {
    throw new Error(`not an editable field: ${field}`)
  }
  if (field === 'content_de') {
    return `UPDATE Documents SET content = ${sqlLiteral(value)} WHERE parallel_of = ${documentId};`
  }
  const where = ENTRY_POINT_ONLY.has(field)
    ? `document_id = ${documentId}`
    : `document_id = ${documentId} OR parallel_of = ${documentId}`
  return `UPDATE Documents SET ${field} = ${sqlLiteral(value)} WHERE ${where};`
}

// ------------------------------------------------------------- word diff

type Op = { kind: 'same' | 'del' | 'add'; words: string[] }

// Paragraph breaks become a visible token, so a merged or split paragraph
// shows up in the diff instead of vanishing into whitespace.
const PARAGRAPH = '¶'

function tokens(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n\s*\n/g, ` ${PARAGRAPH} `)
    .split(/\s+/)
    .filter(Boolean)
}

// The longest common subsequence of words, on what is left once the
// common start and end are trimmed -- an edit is usually local, so the
// table stays small. Past MAX_CELLS (a rewrite of most of a long text) it
// gives up on alignment and reports the middle as replaced whole.
const MAX_CELLS = 4_000_000

function diffWords(a: string[], b: string[]): Op[] {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const ops: Op[] = []
  const push = (kind: Op['kind'], word: string) => {
    const last = ops[ops.length - 1]
    if (last?.kind === kind) last.words.push(word)
    else ops.push({ kind, words: [word] })
  }
  a.slice(0, start).forEach((w) => push('same', w))

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const n = midA.length
  const m = midB.length
  if ((n + 1) * (m + 1) > MAX_CELLS) {
    midA.forEach((w) => push('del', w))
    midB.forEach((w) => push('add', w))
  } else {
    // lcs[i][j]: common words in midA[i..] and midB[j..].
    const width = m + 1
    const lcs = new Uint32Array((n + 1) * width)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i * width + j] =
          midA[i] === midB[j]
            ? lcs[(i + 1) * width + j + 1] + 1
            : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        push('same', midA[i])
        i++
        j++
      } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
        push('del', midA[i++])
      } else {
        push('add', midB[j++])
      }
    }
    while (i < n) push('del', midA[i++])
    while (j < m) push('add', midB[j++])
  }

  a.slice(endA).forEach((w) => push('same', w))
  return ops
}

// The change as one line of text: removed words in [-...-], added in
// {+...+}, and unchanged stretches cut down to the few words either side
// of a change. Reading a 3,000-word body as before-and-after blocks is how
// a stray deleted paragraph gets through a review; this is what makes the
// review real.
export function wordDiff(before: string, after: string, context = 6): string {
  const ops = diffWords(tokens(before), tokens(after))
  if (ops.every((op) => op.kind === 'same')) return '(no change in wording)'

  const parts: string[] = []
  ops.forEach((op, index) => {
    const text = op.words.join(' ')
    if (op.kind === 'del') return parts.push(`[-${text}-]`)
    if (op.kind === 'add') return parts.push(`{+${text}+}`)
    const isFirst = index === 0
    const isLast = index === ops.length - 1
    const words = op.words
    if (isFirst && words.length > context) {
      parts.push(`… ${words.slice(-context).join(' ')}`)
    } else if (isLast && words.length > context) {
      parts.push(`${words.slice(0, context).join(' ')} …`)
    } else if (!isFirst && !isLast && words.length > context * 2) {
      parts.push(
        `${words.slice(0, context).join(' ')} … ${words.slice(-context).join(' ')}`,
      )
    } else {
      parts.push(text)
    }
  })
  return parts.join(' ')
}
