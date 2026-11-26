// Applies what admins have staged on the site -- edits to texts, photo
// tags -- to the archive, in one reviewed batch. Run from app/:
//
//   node scripts/reviewEdits.ts                 # the report
//   node scripts/reviewEdits.ts --out=edits.sql # SQL, applied by hand
//   node scripts/reviewEdits.ts --apply         # do the whole thing
//
// The website never writes to the archive. Its tools collect changes in
// two DynamoDB tables -- the staged-edits queue (texts now, more kinds
// later) and the photo tags -- and this reads both back, checks each
// change against the archive as it is NOW, and emits one transaction.
// It replaces reviewTextEdits.ts and reviewPhotoTags.ts, so there is one
// backup, one rehearsal, one export and one snapshot push per batch.
//
// What it does with each change:
//   ready            applied
//   already applied  skipped (and cleared from the queue)
//   conflict         HELD BACK: the archive no longer holds the value the
//                    edit saw, so someone changed it in the meantime.
//                    Reported, left in the queue, and the rest applied --
//                    one stale edit doesn't hold up the batch.
//   missing          HELD BACK: names a text, person or photograph that
//                    no longer exists.
//   draft            not touched: work in progress, not yet submitted.
//
// Long text changes are shown as a word diff, not before-and-after
// blocks, so a stray deletion is visible.
//
// --apply backs up, rehearses on a copy of the backup, applies, exports,
// clears applied edits from the queue, and pushes the snapshot the API
// reads. Commit and deploy are left to you, after reading the export's
// diff. Photo tags are never cleared: the tagging page reads its own
// table to show who has been tagged.
//
// Needs AWS credentials (the frau-erica-v2-deploy profile) and read
// access to the archive, both of which this machine already has.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import path from 'node:path'
import { toBlocks } from './parallelTextSplitter.ts'
import { validateParallelTexts, type ParallelRow } from './parallelTextValidation.ts'
import {
  DOCUMENT_FIELDS,
  LINK_PREFIX,
  documentStatement,
  isPlainType,
  plainStatement,
  PLAIN_RECORDS,
  type PlainType,
  judge,
  wordDiff,
  type Value,
} from './editReview.ts'

const DEFAULT_DB =
  '/Users/ansonnickel/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db'
const BACKUP_SCRIPT = path.join(homedir(), 'scripts/frau-erica-backup.sh')

function flag(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const dbPath = flag('db') ?? process.env.FRAU_ERICA_DB ?? DEFAULT_DB
const editsTable = flag('edits-table') ?? 'frau-erica-api-edits'
const tagsTable = flag('tags-table') ?? 'frau-erica-api-photo-tags'
const db = new DatabaseSync(dbPath, { readOnly: true })
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' }),
)

async function scan<T>(table: string): Promise<T[]> {
  const items: T[] = []
  let startKey: Record<string, unknown> | undefined
  do {
    const page = await ddb.send(
      new ScanCommand({ TableName: table, ExclusiveStartKey: startKey }),
    )
    items.push(...((page.Items ?? []) as T[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return items
}

type Status = 'ready' | 'already applied' | 'conflict' | 'missing' | 'unpaired' | 'draft'

// ------------------------------------------------------------ the archive

const personName = db.prepare(
  `SELECT first_name || ' ' || last_name AS name FROM Persons WHERE person_id = ?`,
)
function nameOf(personId: number): string | null {
  return (personName.get(personId) as { name: string } | undefined)?.name ?? null
}

const documentRow = db.prepare(
  `SELECT title, content, author, author_person_id, genre, summary, parallel_of,
          (SELECT count(*) FROM Documents h WHERE h.parallel_of = d.document_id) AS halves,
          (SELECT content FROM Documents h WHERE h.parallel_of = d.document_id
            ORDER BY h.document_id LIMIT 1) AS content_de
     FROM Documents d WHERE document_id = ?`,
)
type DocumentRow = { parallel_of: number | null; halves: number } & Record<
  (typeof DOCUMENT_FIELDS)[number],
  Value
>
// Linked on either half of the pair -- the same question the API asks.
const isLinked = db.prepare(
  `SELECT count(*) AS n FROM DocumentLinks
    WHERE person_id = :person
      AND (document_id = :doc
           OR document_id IN (SELECT document_id FROM Documents WHERE parallel_of = :doc))`,
)

// ------------------------------------------------------- staged edits

interface Edit {
  entity: string
  field: string
  value: Value
  was: Value
  status: 'draft' | 'submitted'
  edited_by: string
  edited_at: string
}

interface CheckedEdit extends Edit {
  type: string
  // A number, or a collection's key ("FredKnief").
  id: number | string
  verdict: Status
  now: Value
  problem?: string
  statement?: string
}

function checkDocument(edit: CheckedEdit): CheckedEdit {
  const doc = documentRow.get(edit.id) as DocumentRow | undefined
  if (!doc || doc.parallel_of !== null) {
    return { ...edit, verdict: 'missing', now: null, problem: 'no such text' }
  }
  if (edit.field === 'content_de' && doc.halves === 0) {
    return { ...edit, verdict: 'missing', now: null, problem: 'no German half' }
  }
  let now: Value
  if (edit.field.startsWith(LINK_PREFIX)) {
    const personId = Number(edit.field.slice(LINK_PREFIX.length))
    if (edit.value === true && nameOf(personId) === null) {
      return { ...edit, verdict: 'missing', now: null, problem: `no person ${personId}` }
    }
    now = (isLinked.get({ ':person': personId, ':doc': edit.id }) as { n: number }).n > 0
  } else if ((DOCUMENT_FIELDS as readonly string[]).includes(edit.field)) {
    now = doc[edit.field as (typeof DOCUMENT_FIELDS)[number]]
    if (
      edit.field === 'author_person_id' &&
      typeof edit.value === 'number' &&
      nameOf(edit.value) === null
    ) {
      return { ...edit, verdict: 'missing', now, problem: `no person ${edit.value}` }
    }
  } else {
    return {
      ...edit,
      verdict: 'missing',
      now: null,
      problem: `unknown field ${edit.field}`,
    }
  }
  const verdict = judge(edit.value, edit.was, now)
  return {
    ...edit,
    verdict,
    now,
    statement:
      verdict === 'ready'
        ? documentStatement(edit.id as number, edit.field, edit.value)
        : undefined,
  }
}

// A photograph, gallery or collection: one row, plain columns.
function plainRow(
  type: PlainType,
  id: number | string,
): Record<string, Value> | undefined {
  const { table, key, nameColumn, fields } = PLAIN_RECORDS[type]
  return db
    .prepare(
      `SELECT ${nameColumn} AS __name, ${fields.join(', ')} FROM ${table} WHERE ${key} = ?`,
    )
    .get(id) as Record<string, Value> | undefined
}

function checkPlain(edit: CheckedEdit, type: PlainType): CheckedEdit {
  const row = plainRow(type, edit.id)
  if (!row) return { ...edit, verdict: 'missing', problem: `no such ${type}` }
  if (!(PLAIN_RECORDS[type].fields as readonly string[]).includes(edit.field)) {
    return { ...edit, verdict: 'missing', problem: `unknown field ${edit.field}` }
  }
  const now = row[edit.field] ?? null
  const verdict = judge(edit.value, edit.was, now)
  return {
    ...edit,
    verdict,
    now,
    statement:
      verdict === 'ready'
        ? plainStatement(type, edit.id, edit.field, edit.value)
        : undefined,
  }
}

function checkEdit(raw: Edit): CheckedEdit {
  const [type, idText] = raw.entity.split('#')
  const numeric =
    type === 'document' || (isPlainType(type) && PLAIN_RECORDS[type].numericKey)
  const edit: CheckedEdit = {
    ...raw,
    type,
    id: numeric ? Number(idText) : idText,
    verdict: 'ready',
    now: null,
  }
  if (raw.status === 'draft') return { ...edit, verdict: 'draft' }
  if (type === 'document') return checkDocument(edit)
  if (isPlainType(type)) return checkPlain(edit, type)
  return { ...edit, verdict: 'missing', problem: `unknown record type ${type}` }
}

// ---------------------------------------------------------- photo tags

interface Tag {
  image_id: number
  person_id: number
  gallery_id: number
  tagged_by: string
  tagged_at: string
}

interface CheckedTag extends Tag {
  verdict: 'ready' | 'already applied' | 'missing'
  url: string | null
  person: string | null
}

const imageUrl = db.prepare(`SELECT url FROM Images WHERE image_id = ?`)
// Already in the archive? Re-applying would add a duplicate ImageLinks
// row, which nothing in the schema prevents.
const alreadyTagged = db.prepare(
  `SELECT count(*) AS n FROM ImageLinks WHERE image_id = ? AND person_id = ?`,
)

function checkTag(tag: Tag): CheckedTag {
  const url = (imageUrl.get(tag.image_id) as { url: string } | undefined)?.url ?? null
  const person = nameOf(tag.person_id)
  if (url === null || person === null) return { ...tag, verdict: 'missing', url, person }
  const linked = (alreadyTagged.get(tag.image_id, tag.person_id) as { n: number }).n > 0
  return { ...tag, verdict: linked ? 'already applied' : 'ready', url, person }
}

// -------------------------------------------------------------- report

// A bilingual text's two bodies must still pair up, paragraph for
// paragraph, once its ready edits are applied -- judged on the result,
// the ready half or halves over the archive's other one. The API refuses
// an unpaired submit, but an edit to one half can be held back as a
// conflict while the other is ready, and applying that one alone would
// set the text's paragraphs against the wrong translation. So if the
// result wouldn't pair, every body edit on that text waits.
function holdUnpaired(list: CheckedEdit[]): CheckedEdit[] {
  const isBody = (e: CheckedEdit) => e.field === 'content' || e.field === 'content_de'
  const unpaired = new Map<string, string>()
  for (const entity of new Set(
    list.filter((e) => e.type === 'document').map((e) => e.entity),
  )) {
    const ready = list.filter(
      (e) => e.entity === entity && e.verdict === 'ready' && isBody(e),
    )
    if (ready.length === 0) continue
    const doc = documentRow.get(ready[0].id) as DocumentRow | undefined
    if (!doc || doc.halves === 0) continue
    const result = (field: 'content' | 'content_de') =>
      String(ready.find((e) => e.field === field)?.value ?? doc[field] ?? '')
    const english = toBlocks(result('content')).length
    const german = toBlocks(result('content_de')).length
    if (english !== german) {
      unpaired.set(
        entity,
        `would leave ${english} English paragraphs beside ${german} German`,
      )
    }
  }
  return list.map((e) =>
    unpaired.has(e.entity) && isBody(e) && e.verdict === 'ready'
      ? {
          ...e,
          verdict: 'unpaired',
          problem: unpaired.get(e.entity),
          statement: undefined,
        }
      : e,
  )
}

const edits = holdUnpaired((await scan<Edit>(editsTable)).map(checkEdit))
const tags = (await scan<Tag>(tagsTable)).map(checkTag)

function describe(field: string, value: Value): string {
  if (value === null) return '(none)'
  if (field === 'author_person_id')
    return `${nameOf(value as number) ?? '??'} (#${value})`
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

// Long enough that before-and-after blocks stop being readable.
const DIFF_FROM = 120

function printEdit(edit: CheckedEdit): void {
  const mark =
    edit.verdict === 'ready'
      ? ''
      : `  [${edit.verdict.toUpperCase()}${edit.problem ? `: ${edit.problem}` : ''}]`
  if (edit.field.startsWith(LINK_PREFIX)) {
    const personId = Number(edit.field.slice(LINK_PREFIX.length))
    const sign = edit.value === true ? '+ link  ' : '- unlink'
    console.log(`  ${sign} ${nameOf(personId) ?? '??'} (#${personId})${mark}`)
  } else {
    console.log(`  ${edit.field}:${mark}`)
    const long = [edit.was, edit.value].some(
      (v) => typeof v === 'string' && v.length > DIFF_FROM,
    )
    if (long && edit.verdict === 'conflict') {
      // Two diffs from the value the edit saw: what the archive did since,
      // and what the edit wants. Printing three whole bodies says nothing.
      const was = String(edit.was ?? '')
      console.log(`      archive since: ${wordDiff(was, String(edit.now ?? ''))}`)
      console.log(`      edit wanted:   ${wordDiff(was, String(edit.value ?? ''))}`)
    } else if (long) {
      console.log(`      ${wordDiff(String(edit.was ?? ''), String(edit.value ?? ''))}`)
    } else {
      console.log(`      was ${describe(edit.field, edit.was)}`)
      if (edit.verdict === 'conflict') {
        console.log(
          `      NOW ${describe(edit.field, edit.now)}  <- changed since the edit`,
        )
      }
      console.log(`      new ${describe(edit.field, edit.value)}`)
    }
  }
  console.log(`      (${edit.edited_by}, ${edit.edited_at.slice(0, 10)})`)
}

const byEntity = new Map<string, CheckedEdit[]>()
for (const edit of edits)
  byEntity.set(edit.entity, [...(byEntity.get(edit.entity) ?? []), edit])

const entities = [...byEntity.keys()].sort((a, b) => {
  const [ta, ia] = a.split('#')
  const [tb, ib] = b.split('#')
  return ta.localeCompare(tb) || Number(ia) - Number(ib) || ia.localeCompare(ib)
})
for (const entity of entities) {
  const group = byEntity.get(entity)!
  const { type, id } = group[0]
  const [label, title] =
    type === 'document'
      ? [
          'Text',
          (documentRow.get(id) as DocumentRow | undefined)?.title ?? '(no such text)',
        ]
      : isPlainType(type)
        ? [
            PLAIN_RECORDS[type].label,
            String(plainRow(type, id)?.__name ?? '(no such record)'),
          ]
        : [type, '']
  console.log(`\n${'='.repeat(78)}`)
  console.log(`${label} ${id}: ${title}`)
  console.log('='.repeat(78))
  group.sort((a, b) => a.field.localeCompare(b.field)).forEach(printEdit)
}

const newTags = tags.filter((t) => t.verdict !== 'already applied')
if (newTags.length > 0) {
  console.log(`\n${'='.repeat(78)}`)
  console.log('Photo tags')
  console.log('='.repeat(78))
  const byImage = new Map<number, CheckedTag[]>()
  for (const tag of newTags)
    byImage.set(tag.image_id, [...(byImage.get(tag.image_id) ?? []), tag])
  for (const [imageId, group] of byImage) {
    const names = group
      .map((t) =>
        t.verdict === 'missing'
          ? `?? person ${t.person_id} [MISSING]`
          : `${t.person} (#${t.person_id})`,
      )
      .join(', ')
    console.log(`  ${group[0].url ?? `?? image ${imageId} [MISSING]`}: ${names}`)
  }
}

const count = <T extends { verdict: string }>(list: T[], verdict: string) =>
  list.filter((x) => x.verdict === verdict).length

const readyEdits = edits.filter((e) => e.verdict === 'ready')
const readyTags = tags.filter((t) => t.verdict === 'ready')
const heldBack =
  count(edits, 'conflict') +
  count(edits, 'missing') +
  count(edits, 'unpaired') +
  count(tags, 'missing')

console.log(`\n${'='.repeat(78)}`)
console.log(`Text and record edits: ${edits.length} on ${byEntity.size} records`)
console.log(`  ready to apply:          ${readyEdits.length}`)
console.log(`  already in the archive:  ${count(edits, 'already applied')}`)
if (count(edits, 'draft'))
  console.log(`  drafts, not submitted:   ${count(edits, 'draft')}`)
if (count(edits, 'conflict'))
  console.log(`  HELD BACK, conflict:     ${count(edits, 'conflict')}`)
if (count(edits, 'missing'))
  console.log(`  HELD BACK, missing:      ${count(edits, 'missing')}`)
if (count(edits, 'unpaired'))
  console.log(`  HELD BACK, unpaired:     ${count(edits, 'unpaired')}`)
console.log(`Photo tags: ${tags.length}`)
console.log(`  ready to apply:          ${readyTags.length}`)
console.log(`  already in the archive:  ${count(tags, 'already applied')}`)
if (count(tags, 'missing'))
  console.log(`  HELD BACK, missing:      ${count(tags, 'missing')}`)

function sql(): string {
  return [
    '-- Staged edits and photo tags, from the site.',
    '-- Generated by scripts/reviewEdits.ts.',
    `-- ${readyEdits.length} edits and ${readyTags.length} photo tags; ${heldBack} held back.`,
    '',
    'PRAGMA foreign_keys = ON;',
    'BEGIN;',
    '',
    ...readyEdits.map(
      (e) => `-- ${e.entity}, ${e.field} (edited by ${e.edited_by})\n${e.statement}`,
    ),
    ...readyTags.map(
      (t) =>
        `-- ${t.url} : ${t.person}  (tagged by ${t.tagged_by})\n` +
        `INSERT INTO ImageLinks (image_id, person_id) VALUES (${t.image_id}, ${t.person_id});`,
    ),
    '',
    'COMMIT;',
    '',
  ].join('\n')
}

function sqlite(file: string, statement: string): string {
  return execFileSync('sqlite3', [file, statement], { encoding: 'utf-8' }).trim()
}

function runSqlFile(file: string, sqlFile: string): void {
  execFileSync('sqlite3', [file], {
    input: readFileSync(sqlFile, 'utf-8'),
    encoding: 'utf-8',
  })
}

// Clears edits that are now in the archive -- conditionally on edited_at,
// so an edit made to the same field while this ran survives to the next
// batch rather than being deleted along with the one it replaced.
async function clear(list: Edit[]): Promise<number> {
  let cleared = 0
  for (const edit of list) {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: editsTable,
          Key: { entity: edit.entity, field: edit.field },
          ConditionExpression: 'edited_at = :at',
          ExpressionAttributeValues: { ':at': edit.edited_at },
        }),
      )
      cleared += 1
    } catch (error) {
      if ((error as Error).name !== 'ConditionalCheckFailedException') throw error
    }
  }
  return cleared
}

const alreadyApplied = edits.filter((e) => e.verdict === 'already applied')
const out = flag('out')

if (has('apply')) {
  if (readyEdits.length === 0 && readyTags.length === 0) {
    const cleared = await clear(alreadyApplied)
    console.log(
      `\nNothing to apply.` +
        (cleared ? ` Cleared ${cleared} already applied from the queue.` : ''),
    )
    process.exit(0)
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backup = `/tmp/frau_erica.pre-edits-${stamp}.db`
  const sqlFile = `/tmp/edits-${stamp}.sql`
  writeFileSync(sqlFile, sql(), 'utf-8')

  console.log(`\n1/6  backing up the archive`)
  // sqlite3's own .backup, not a file copy: copying a database with an
  // open write transaction copies a torn file.
  sqlite(dbPath, `.backup '${backup}'`)
  console.log(`     ${backup}`)

  console.log('2/6  rehearsing on a copy of the backup')
  // On a COPY, so the file announced as the backup really is pre-change
  // (both old scripts once rehearsed on the backup itself; 2026-11-11).
  // Foreign-key violations are compared with the archive's own: it
  // carries two long-standing orphans, so the question is whether this
  // adds any, not whether there are none.
  const rehearsal = `/tmp/frau_erica.rehearsal-edits-${stamp}.db`
  sqlite(backup, `.backup '${rehearsal}'`)
  const fkBefore = sqlite(rehearsal, 'PRAGMA foreign_key_check;')
  runSqlFile(rehearsal, sqlFile)
  const rehearsed = sqlite(rehearsal, 'PRAGMA integrity_check;')
  const fkAfter = sqlite(rehearsal, 'PRAGMA foreign_key_check;')
  // The export's own check that every bilingual pair still lines up,
  // run on the rehearsal: the export runs after the archive is changed,
  // and refusing then would leave the archive holding an unpaired text.
  const rehearsedDb = new DatabaseSync(rehearsal, { readOnly: true })
  const pairing = validateParallelTexts(
    rehearsedDb
      .prepare(
        'SELECT document_id, title, content, summary, language, parallel_of, is_published FROM Documents',
      )
      .all() as unknown as ParallelRow[],
  )
  rehearsedDb.close()
  if (pairing.errors.length > 0) {
    console.error(
      `     bilingual texts would no longer pair:\n       ${pairing.errors.join('\n       ')}`,
    )
    console.error('     stopping, archive untouched.')
    process.exit(1)
  }
  if (rehearsed !== 'ok' || fkAfter !== fkBefore) {
    console.error(
      `     integrity "${rehearsed}"; foreign keys before:\n${fkBefore}\nafter:\n${fkAfter}`,
    )
    console.error('     stopping, archive untouched.')
    process.exit(1)
  }
  console.log('     ok')

  console.log('3/6  applying to the archive')
  runSqlFile(dbPath, sqlFile)
  const result = sqlite(dbPath, 'PRAGMA integrity_check;')
  if (result !== 'ok') {
    console.error(`     integrity_check said "${result}" -- restore from ${backup}`)
    process.exit(1)
  }
  console.log(
    `     ${readyEdits.length} edits and ${readyTags.length} photo tags, integrity ok`,
  )

  console.log('4/6  exporting')
  execFileSync('npm', ['run', 'export-data'], {
    cwd: path.join(import.meta.dirname, '..'),
    stdio: 'ignore',
  })
  console.log('     done')

  console.log('5/6  clearing applied edits from the queue')
  console.log(`     ${await clear([...readyEdits, ...alreadyApplied])} cleared`)

  console.log('6/6  pushing the snapshot the API reads')
  execFileSync(BACKUP_SCRIPT, { stdio: 'ignore' })
  console.log('     done')

  if (heldBack > 0) {
    console.log(`\n${heldBack} held back and left in the queue -- see above.`)
  }
  console.log(`\nApplied. Read the diff (git diff src/data/generated/), commit, then:`)
  console.log('  hosting/deploy-app.sh')
  console.log(`Backup kept at ${backup}`)
} else if (out) {
  writeFileSync(out, sql(), 'utf-8')
  console.log(`\nWrote ${readyEdits.length + readyTags.length} statements to ${out}.`)
} else {
  console.log('\nNothing written. --out=edits.sql for the SQL, or --apply to do it all.')
}
