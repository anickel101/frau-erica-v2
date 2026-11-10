// Turns edits collected by /admin/tag-texts into changes to Documents and
// DocumentLinks. Run from app/:
//
//   node scripts/reviewTextEdits.ts                 # the report
//   node scripts/reviewTextEdits.ts --out=edits.sql # SQL, applied by hand
//   node scripts/reviewTextEdits.ts --apply         # do the whole thing
//
// The text-shaped sibling of reviewPhotoTags.ts. The web tool collects
// edits into their own DynamoDB table and never touches the archive (see
// api/CLAUDE.md's "Text tagging"); this reads them back, checks each one
// against the archive as it is NOW, and emits the SQL.
//
// Each edit carries the value the archive held when it was made. If the
// archive no longer holds that value -- the archivist changed the same
// field directly in the database in the meantime -- the edit is a
// CONFLICT and nothing is applied until it is resolved, rather than one
// of the two changes silently overwriting the other.
//
// Byline, author record and genre are written to both halves of a
// bilingual pair, which the archive has always kept in agreement (78 of
// 78). A summary belongs to the English entry point alone. An unlink
// removes the person from both halves, since 65 existing links sit on a
// German half.
//
// --apply backs up, rehearses on the backup, applies, exports, clears the
// applied edits from the table, and pushes the snapshot the API reads --
// so the tagging page shows the new state. Commit and deploy are left to
// you, after reading the export's diff.
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

const DEFAULT_DB =
  '/Users/ansonnickel/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db'
const DEFAULT_TABLE = 'frau-erica-api-text-edits'
const BACKUP_SCRIPT = path.join(homedir(), 'scripts/frau-erica-backup.sh')

function flag(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const dbPath = flag('db') ?? process.env.FRAU_ERICA_DB ?? DEFAULT_DB
const table = flag('table') ?? DEFAULT_TABLE
const db = new DatabaseSync(dbPath, { readOnly: true })
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' }),
)

type Value = string | number | boolean | null

interface Edit {
  document_id: number
  field: string
  value: Value
  was: Value
  edited_by: string
  edited_at: string
}

async function allEdits(): Promise<Edit[]> {
  const edits: Edit[] = []
  let startKey: Record<string, unknown> | undefined
  do {
    const page = await ddb.send(
      new ScanCommand({ TableName: table, ExclusiveStartKey: startKey }),
    )
    edits.push(...((page.Items ?? []) as Edit[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return edits
}

const SCALAR_FIELDS = ['author', 'author_person_id', 'genre', 'summary'] as const
type ScalarField = (typeof SCALAR_FIELDS)[number]
const LINK_PREFIX = 'person#'

const documentRow = db.prepare(
  `SELECT title, author, author_person_id, genre, summary, parallel_of, is_published
     FROM Documents WHERE document_id = ?`,
)
const personName = db.prepare(
  `SELECT first_name || ' ' || last_name AS name FROM Persons WHERE person_id = ?`,
)
// Linked on either half of the pair -- the same question the API asks.
const isLinked = db.prepare(
  `SELECT count(*) AS n FROM DocumentLinks
    WHERE person_id = :person
      AND (document_id = :doc
           OR document_id IN (SELECT document_id FROM Documents WHERE parallel_of = :doc))`,
)

type DocumentRow = {
  title: string
  parallel_of: number | null
  is_published: number
} & Record<ScalarField, Value>

type Status = 'ready' | 'already applied' | 'conflict' | 'missing'

interface Checked extends Edit {
  status: Status
  now: Value
  problem?: string
}

function nameOf(personId: number): string | null {
  return (personName.get(personId) as { name: string } | undefined)?.name ?? null
}

function check(edit: Edit): Checked {
  const doc = documentRow.get(edit.document_id) as DocumentRow | undefined
  if (!doc || doc.parallel_of !== null) {
    return { ...edit, status: 'missing', now: null, problem: 'no such text' }
  }

  let now: Value
  if (edit.field.startsWith(LINK_PREFIX)) {
    const personId = Number(edit.field.slice(LINK_PREFIX.length))
    if (edit.value === true && nameOf(personId) === null) {
      return { ...edit, status: 'missing', now: null, problem: `no person ${personId}` }
    }
    now =
      (isLinked.get({ ':person': personId, ':doc': edit.document_id }) as { n: number })
        .n > 0
  } else if ((SCALAR_FIELDS as readonly string[]).includes(edit.field)) {
    now = doc[edit.field as ScalarField]
    if (
      edit.field === 'author_person_id' &&
      typeof edit.value === 'number' &&
      nameOf(edit.value) === null
    ) {
      return { ...edit, status: 'missing', now, problem: `no person ${edit.value}` }
    }
  } else {
    return {
      ...edit,
      status: 'missing',
      now: null,
      problem: `unknown field ${edit.field}`,
    }
  }

  if (now === edit.value) return { ...edit, status: 'already applied', now }
  if (now !== edit.was) return { ...edit, status: 'conflict', now }
  return { ...edit, status: 'ready', now }
}

function describe(field: string, value: Value): string {
  if (value === null) return '(none)'
  if (field === 'author_person_id')
    return `${nameOf(value as number) ?? '??'} (#${value})`
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

function sqlLiteral(value: Value): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${value.replace(/'/g, "''")}'`
}

function statementFor(edit: Checked): string {
  const doc = edit.document_id
  if (edit.field.startsWith(LINK_PREFIX)) {
    const personId = Number(edit.field.slice(LINK_PREFIX.length))
    return edit.value === true
      ? `INSERT INTO DocumentLinks (document_id, person_id) VALUES (${doc}, ${personId});`
      : `DELETE FROM DocumentLinks WHERE person_id = ${personId}\n` +
          `   AND (document_id = ${doc} OR document_id IN ` +
          `(SELECT document_id FROM Documents WHERE parallel_of = ${doc}));`
  }
  // The summary is the English entry point's own; the rest is shared
  // with a German half, if there is one.
  const where =
    edit.field === 'summary'
      ? `document_id = ${doc}`
      : `document_id = ${doc} OR parallel_of = ${doc}`
  return `UPDATE Documents SET ${edit.field} = ${sqlLiteral(edit.value)} WHERE ${where};`
}

// ----------------------------------------------------------------- report

const checked = (await allEdits()).map(check)

const byDocument = new Map<number, Checked[]>()
for (const edit of checked) {
  byDocument.set(edit.document_id, [...(byDocument.get(edit.document_id) ?? []), edit])
}

for (const [documentId, edits] of [...byDocument].sort((a, b) => a[0] - b[0])) {
  const doc = documentRow.get(documentId) as DocumentRow | undefined
  console.log(`\n${'='.repeat(78)}`)
  console.log(`Text ${documentId}: ${doc?.title ?? '(no such text)'}`)
  console.log('='.repeat(78))

  edits.sort((a, b) => a.field.localeCompare(b.field))
  for (const edit of edits) {
    const tag =
      edit.status === 'ready'
        ? ''
        : `  [${edit.status}${edit.problem ? `: ${edit.problem}` : ''}]`
    if (edit.field.startsWith(LINK_PREFIX)) {
      const personId = Number(edit.field.slice(LINK_PREFIX.length))
      const sign = edit.value === true ? '+ link  ' : '- unlink'
      console.log(`  ${sign} ${nameOf(personId) ?? '??'} (#${personId})${tag}`)
    } else {
      console.log(`  ${edit.field}:${tag}`)
      console.log(`      was ${describe(edit.field, edit.was)}`)
      if (edit.status === 'conflict') {
        console.log(
          `      NOW ${describe(edit.field, edit.now)}  <- changed since the edit`,
        )
      }
      console.log(`      new ${describe(edit.field, edit.value)}`)
    }
    console.log(`      (${edit.edited_by}, ${edit.edited_at.slice(0, 10)})`)
  }

  // A record with no byline prints nothing at all on the page: TextByline
  // prints the byline and only uses the record to decide whether it links.
  const after = (field: ScalarField) =>
    edits.find((e) => e.field === field && e.status !== 'missing')?.value ??
    doc?.[field] ??
    null
  if (after('author_person_id') !== null && !after('author')) {
    console.log('  WARNING: an author record with no byline shows no author on the page')
  }
}

const ready = checked.filter((e) => e.status === 'ready')
const applied = checked.filter((e) => e.status === 'already applied')
const conflicts = checked.filter((e) => e.status === 'conflict')
const missing = checked.filter((e) => e.status === 'missing')

console.log(`\n${'='.repeat(78)}`)
console.log(`${checked.length} edits on ${byDocument.size} texts`)
console.log(`  ready to apply:         ${ready.length}`)
console.log(`  already in the archive: ${applied.length}`)
if (conflicts.length)
  console.log(`  CONFLICT (archive changed since): ${conflicts.length}`)
if (missing.length) console.log(`  NAME SOMETHING THAT DOESN'T EXIST: ${missing.length}`)

function sql(): string {
  return [
    '-- Text edits, from /admin/tag-texts.',
    '-- Generated by scripts/reviewTextEdits.ts.',
    `-- ${ready.length} changes; ${applied.length} already present and skipped.`,
    '',
    'PRAGMA foreign_keys = ON;',
    'BEGIN;',
    '',
    ...ready.map(
      (e) =>
        `-- text ${e.document_id}, ${e.field} (edited by ${e.edited_by})\n${statementFor(e)}`,
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
async function clear(edits: Edit[]): Promise<number> {
  let cleared = 0
  for (const edit of edits) {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: table,
          Key: { document_id: edit.document_id, field: edit.field },
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

const out = flag('out')

if (has('apply')) {
  if (conflicts.length > 0 || missing.length > 0) {
    console.error(
      '\nRefusing to apply: resolve the conflicts and missing names above first.\n' +
        'Undo an edit on the tagging page, or edit the archive to match it.',
    )
    process.exit(1)
  }
  if (ready.length === 0) {
    const cleared = await clear(applied)
    console.log(
      `\nNothing to apply -- everything collected is already in the archive.` +
        (cleared ? ` Cleared ${cleared} from the queue.` : ''),
    )
    process.exit(0)
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backup = `/tmp/frau_erica.pre-text-edits-${stamp}.db`
  const sqlFile = `/tmp/text-edits-${stamp}.sql`
  writeFileSync(sqlFile, sql(), 'utf-8')

  console.log(`\n1/6  backing up the archive`)
  // sqlite3's own .backup, not a file copy: copying a database with an
  // open write transaction copies a torn file.
  sqlite(dbPath, `.backup '${backup}'`)
  console.log(`     ${backup}`)

  console.log('2/6  rehearsing on the backup')
  // Foreign-key violations compared against the archive's own before
  // state: it carries two long-standing orphans, so the question is
  // whether this adds any, not whether there are none.
  const fkBefore = sqlite(backup, 'PRAGMA foreign_key_check;')
  runSqlFile(backup, sqlFile)
  const rehearsed = sqlite(backup, 'PRAGMA integrity_check;')
  const fkAfter = sqlite(backup, 'PRAGMA foreign_key_check;')
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
  console.log(`     ${ready.length} changes, integrity ok`)

  console.log('4/6  exporting')
  execFileSync('npm', ['run', 'export-data'], {
    cwd: path.join(import.meta.dirname, '..'),
    stdio: 'ignore',
  })
  console.log('     done')

  console.log('5/6  clearing applied edits from the queue')
  console.log(`     ${await clear([...ready, ...applied])} cleared`)

  console.log('6/6  pushing the snapshot the API reads')
  execFileSync(BACKUP_SCRIPT, { stdio: 'ignore' })
  console.log('     done')

  console.log(`\nApplied. Read the diff (git diff src/data/generated/), commit, then:`)
  console.log('  hosting/deploy-app.sh')
  console.log(`Backup kept at ${backup}`)
} else if (out) {
  writeFileSync(out, sql(), 'utf-8')
  console.log(
    `\nWrote ${ready.length} statements to ${out} -- review, then apply with sqlite3.`,
  )
} else {
  console.log('\nNothing written. --out=edits.sql for the SQL, or --apply to do it all.')
}
