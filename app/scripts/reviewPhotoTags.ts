// Turns collected photo tags into ImageLinks rows. Run from app/:
//
//   node scripts/reviewPhotoTags.ts                  # the report
//   node scripts/reviewPhotoTags.ts --gallery=12     # one gallery
//   node scripts/reviewPhotoTags.ts --out=tags.sql   # SQL, applied by hand
//   node scripts/reviewPhotoTags.ts --apply          # do the whole thing
//
// The last step of the tagging pipeline. The web tool collects tags into
// their own DynamoDB table, deliberately never touching the archive (see
// api/CLAUDE.md's "Photo tagging"); this reads them back, resolves every
// id to a name so the proposal is readable by a person, and emits the
// INSERTs. Nothing is written to the archive here either -- same
// propose-then-apply shape as splitParallelText.ts and proposeDates.ts.
//
// --apply is the exception to this project's propose-then-apply habit,
// and deliberately so. Elsewhere -- splitting a parallel text, dating a
// document -- a wrong proposal is silent and hard to undo: paragraphs
// set against the wrong translation read perfectly well. A wrong photo
// tag is none of those things. It is append-only, it is visible on the
// gallery page, and it comes off with one tap in the tagging tool. The
// review step was costing more than it was buying, since reading
// "AnsonMark1.jpg : Mark Nickel" tells you almost nothing without
// looking at the photograph anyway.
//
// What --apply does NOT skip is the safety that actually matters: it
// refuses to run if any tag names something that no longer exists, it
// backs the archive up first, and it rehearses the whole change on that
// backup before touching the real file.
//
// Needs AWS credentials (the frau-erica-v2-deploy profile) and read
// access to the archive, both of which this machine already has.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const DEFAULT_DB =
  '/Users/ansonnickel/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db'
const DEFAULT_TABLE = 'frau-erica-api-photo-tags'

function flag(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const db = new DatabaseSync(flag('db') ?? process.env.FRAU_ERICA_DB ?? DEFAULT_DB, {
  readOnly: true,
})
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' }),
)

interface Tag {
  image_id: number
  person_id: number
  gallery_id: number
  tagged_by: string
  tagged_at: string
}

// Scan rather than Query: this reads the whole table on purpose, because
// the question being asked is "everything collected so far", not
// "everything in one gallery". At a few hundred rows a Scan is a single
// cheap request; --gallery filters afterwards rather than paying for an
// index query this script would use exactly once.
async function allTags(): Promise<Tag[]> {
  const table = flag('table') ?? DEFAULT_TABLE
  const tags: Tag[] = []
  let startKey: Record<string, unknown> | undefined
  do {
    const page = await ddb.send(
      new ScanCommand({ TableName: table, ExclusiveStartKey: startKey }),
    )
    tags.push(...((page.Items ?? []) as Tag[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return tags
}

const personName = db.prepare(
  `SELECT first_name || ' ' || last_name AS name FROM Persons WHERE person_id = ?`,
)
const imageInfo = db.prepare(
  `SELECT url, COALESCE(caption, '') AS caption FROM Images WHERE image_id = ?`,
)
const galleryName = db.prepare(`SELECT name FROM Galleries WHERE gallery_id = ?`)
// Already in the archive? A tag re-applied would be a duplicate
// ImageLinks row, and nothing in the schema prevents one.
const alreadyLinked = db.prepare(
  `SELECT count(*) AS n FROM ImageLinks WHERE image_id = ? AND person_id = ?`,
)

const tags = await allTags()
const wanted = flag('gallery')
const selected = wanted ? tags.filter((t) => t.gallery_id === Number(wanted)) : tags

interface Checked extends Tag {
  person: string | null
  image: string | null
  caption: string
  duplicate: boolean
}

const checked: Checked[] = selected.map((tag) => {
  const person = personName.get(tag.person_id) as { name: string } | undefined
  const image = imageInfo.get(tag.image_id) as
    { url: string; caption: string } | undefined
  return {
    ...tag,
    person: person?.name ?? null,
    image: image?.url ?? null,
    caption: image?.caption ?? '',
    duplicate:
      ((alreadyLinked.get(tag.image_id, tag.person_id) as { n: number }).n ?? 0) > 0,
  }
})

// Grouped by photograph, because that is how a person checks this work:
// looking at one picture and asking whether the names against it are
// right. A flat list of 300 tag rows is unreadable.
const byImage = new Map<number, Checked[]>()
for (const tag of checked) {
  byImage.set(tag.image_id, [...(byImage.get(tag.image_id) ?? []), tag])
}

const galleries = [...new Set(checked.map((t) => t.gallery_id))].sort((a, b) => a - b)
for (const galleryId of galleries) {
  const name = (galleryName.get(galleryId) as { name: string } | undefined)?.name
  console.log(`\n${'='.repeat(78)}`)
  console.log(`Gallery ${galleryId}: ${name ?? '(unknown)'}`)
  console.log('='.repeat(78))

  for (const [imageId, group] of byImage) {
    if (group[0].gallery_id !== galleryId) continue
    const names = group
      .map(
        (t) =>
          `${t.person ?? `?? person ${t.person_id}`}${t.duplicate ? ' [already linked]' : ''}`,
      )
      .join(', ')
    console.log(`\n  ${group[0].image ?? `?? image ${imageId}`}`)
    console.log(`    ${names}`)
    if (group[0].caption) {
      console.log(`    caption: ${group[0].caption.replace(/\s+/g, ' ').slice(0, 72)}`)
    }
  }
}

const missingPerson = checked.filter((t) => t.person === null)
const missingImage = checked.filter((t) => t.image === null)
const duplicates = checked.filter((t) => t.duplicate)
const writable = checked.filter((t) => t.person && t.image && !t.duplicate)

console.log(`\n${'='.repeat(78)}`)
console.log(`${checked.length} tags on ${byImage.size} photographs`)
console.log(`  ready to apply:   ${writable.length}`)
console.log(`  already in the archive: ${duplicates.length}`)
if (missingPerson.length) {
  console.log(`  NAME A PERSON THAT NO LONGER EXISTS: ${missingPerson.length}`)
  for (const t of missingPerson)
    console.log(`    image ${t.image_id} -> person ${t.person_id}`)
}
if (missingImage.length) {
  console.log(`  NAME AN IMAGE THAT NO LONGER EXISTS: ${missingImage.length}`)
  for (const t of missingImage) console.log(`    image ${t.image_id}`)
}

const dbPath = flag('db') ?? process.env.FRAU_ERICA_DB ?? DEFAULT_DB

function sql(): string {
  return [
    '-- Photo tags, ready for ImageLinks.',
    '-- Generated by scripts/reviewPhotoTags.ts.',
    `-- ${writable.length} new links; ${duplicates.length} already present and skipped.`,
    '',
    'PRAGMA foreign_keys = ON;',
    'BEGIN;',
    '',
    ...writable.map(
      (t) =>
        `-- ${t.image} : ${t.person}  (tagged by ${t.tagged_by})\n` +
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

const out = flag('out')

if (has('apply')) {
  // Anything naming a person or an image that no longer exists stops the
  // whole run rather than being quietly skipped. It means the archive
  // moved under the tags, and applying the rest would leave a mess
  // nobody knew about.
  if (missingPerson.length > 0 || missingImage.length > 0) {
    console.error(
      '\nRefusing to apply: some tags name things that no longer exist (above).',
    )
    process.exit(1)
  }

  if (writable.length === 0) {
    console.log('\nNothing to apply -- everything collected is already in the archive.')
    process.exit(0)
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backup = `/tmp/frau_erica.pre-tags-${stamp}.db`
  const sqlFile = `/tmp/photo-tags-${stamp}.sql`
  writeFileSync(sqlFile, sql(), 'utf-8')

  console.log(`\n1/4  backing up the archive`)
  // sqlite3's own .backup, not a file copy: copying a database with an
  // open write transaction copies a torn file.
  sqlite(dbPath, `.backup '${backup}'`)
  console.log(`     ${backup}`)

  console.log('2/4  rehearsing on the backup')
  runSqlFile(backup, sqlFile)
  const rehearsed = sqlite(backup, 'PRAGMA integrity_check;')
  if (rehearsed !== 'ok') {
    console.error(
      `     integrity_check said "${rehearsed}" -- stopping, archive untouched.`,
    )
    process.exit(1)
  }
  console.log('     ok')

  console.log('3/4  applying to the archive')
  runSqlFile(dbPath, sqlFile)
  const applied = sqlite(dbPath, 'PRAGMA integrity_check;')
  if (applied !== 'ok') {
    console.error(`     integrity_check said "${applied}" -- restore from ${backup}`)
    process.exit(1)
  }
  console.log(`     ${writable.length} links added, integrity ok`)

  console.log('4/4  exporting galleries.json')
  execFileSync('npm', ['run', 'export-data'], {
    cwd: path.join(import.meta.dirname, '..'),
    stdio: 'ignore',
  })
  console.log('     done')

  console.log(`\nApplied. Commit the generated JSON, then: hosting/deploy-app.sh`)
  console.log(`Backup kept at ${backup}`)
  console.log('No snapshot push needed -- photo tags are public data, not gated.')
} else if (out) {
  writeFileSync(out, sql(), 'utf-8')
  console.log(
    `\nWrote ${writable.length} INSERTs to ${out} -- review, then apply with sqlite3.`,
  )
} else {
  console.log('\nNothing written. --out=tags.sql for the SQL, or --apply to do it all.')
}
