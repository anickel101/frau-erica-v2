// Proposes a German/English split for interleaved documents. Run from app/:
//
//   node scripts/splitParallelText.ts --ids=87,88        # review two
//   node scripts/splitParallelText.ts --candidates       # find them all
//   node scripts/splitParallelText.ts --ids=87 --full    # every block
//   node scripts/splitParallelText.ts --ids=87 --out=s.sql
//   node scripts/splitParallelText.ts --ids=90 --accept=90 --out=s.sql
//
// --review is the default and the point, the same way importKeepers.ts
// works: the failure to avoid is loading a plausible-looking but wrong
// split into the archive, where the German half of a paragraph ends up
// against the wrong English one and nobody notices for a year. Nothing
// is written unless --out is passed, and even then this emits SQL for
// review rather than connecting to the database to write.
//
// --out emits only the documents that came back CLEAN. A document the
// splitter flagged is not necessarily wrong -- documents 90 and 92
// split correctly and are flagged only because a handful of their
// blocks are too short to classify on their own words ("**A Corpse**")
// -- but "flagged" and "checked by a person" are different states, and
// only the second one may be written. --accept=90,92 is how someone
// says they have read those two proposals and stands behind them; it
// names document ids deliberately, so it cannot be used as a blanket
// "ignore all warnings".
//
// Opens the database READ-ONLY, so it cannot damage the archive whatever
// it is asked to do.
//
// The proposal for each document is:
//   - the existing row keeps the ENGLISH content, gains language='en'
//   - a new row holds the GERMAN content, language='de', parallel_of
//     pointing back at the English row, and no summary
// which is the arrangement schema.sql's note under Documents describes.

import { DatabaseSync } from 'node:sqlite'
import { writeFileSync } from 'node:fs'
import { splitParallelText, toBlocks } from './parallelTextSplitter.ts'
import type { SplitProposal } from './parallelTextSplitter.ts'

const DEFAULT_DB =
  '/Users/ansonnickel/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db'

function flag(name: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`))
  return found?.slice(name.length + 3)
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const dbPath = flag('db') ?? process.env.FRAU_ERICA_DB ?? DEFAULT_DB
const db = new DatabaseSync(dbPath, { readOnly: true })

interface DocumentRow {
  document_id: number
  title: string
  series_key: string | null
  series_title: string | null
  series_order: number | null
  genre: string | null
  tags: string | null
  content: string
  language: string | null
  parallel_of: number | null
}

// A rough count of how much of a document reads as German, used only to
// suggest candidates -- the splitter itself does the real work. A
// document that is half German and half English is the shape being
// looked for; one that merely quotes a German phrase is not.
function germanShare(content: string): number {
  const blocks = toBlocks(content)
  if (blocks.length === 0) return 0
  const german = blocks.filter((b) => /[äöüÄÖÜß]/.test(b)).length
  return german / blocks.length
}

function listCandidates(): void {
  const rows = db
    .prepare(
      `SELECT document_id, title, content, is_published, language, parallel_of
         FROM Documents
        WHERE content IS NOT NULL AND content <> ''
        ORDER BY document_id`,
    )
    .all() as unknown as (DocumentRow & { is_published: number })[]

  console.log('Documents that look interleaved (>=25% of blocks contain German):\n')
  console.log('  doc  pub  split  German%  blocks  title')
  for (const row of rows) {
    const share = germanShare(row.content)
    if (share < 0.25) continue
    const done = row.language !== null || row.parallel_of !== null ? 'yes' : '-'
    console.log(
      `  ${String(row.document_id).padStart(3)}  ${row.is_published ? ' 1 ' : ' 0 '}` +
        `  ${done.padStart(5)}  ${String(Math.round(share * 100)).padStart(6)}%` +
        `  ${String(toBlocks(row.content).length).padStart(6)}  ${row.title.slice(0, 48)}`,
    )
  }
  console.log('\nThen: node scripts/splitParallelText.ts --ids=<those you want>')
}

function truncate(text: string, length: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= length ? flat : `${flat.slice(0, length - 1)}…`
}

function report(row: DocumentRow, proposal: SplitProposal, full: boolean): void {
  const status = proposal.clean ? 'CLEAN' : 'NEEDS REVIEW'
  console.log(`\n${'='.repeat(78)}`)
  console.log(`${row.document_id}  ${row.title}`)
  console.log(`${'='.repeat(78)}`)

  if (row.language !== null || row.parallel_of !== null) {
    console.log('ALREADY SPLIT -- this document has language/parallel_of set. Skipping.')
    return
  }

  const germanBlocks = proposal.pairs.reduce((n, p) => n + p.german.length, 0)
  console.log(
    `${status}   ${proposal.pairs.length} section pairs, ` +
      `${germanBlocks} blocks per language, ` +
      `sizes [${proposal.pairs.map((p) => p.german.length).join(', ')}]`,
  )

  for (const note of proposal.notes) console.log(`  note:    ${note}`)
  for (const warning of proposal.warnings) console.log(`  WARNING: ${warning}`)

  if (proposal.uncertain.length > 0) {
    console.log(`\n  ${proposal.uncertain.length} block(s) worth checking by eye:`)
    for (const block of proposal.uncertain) {
      console.log(
        `    block ${String(block.index).padStart(3)} -> ${block.language}  ` +
          `own ${block.ownConfidence.toFixed(2)} / pair ${block.pairConfidence.toFixed(2)}  ` +
          `${truncate(block.text, 60)}`,
      )
    }
  }

  // The pairing itself, which is the thing actually being reviewed:
  // each German block beside the English it would be set against. Read
  // the two columns and it is obvious when a pair has slipped.
  if (full || !proposal.clean) {
    console.log('\n  proposed pairing:')
    for (const [index, pair] of proposal.pairs.entries()) {
      console.log(`\n  -- section ${index + 1} --`)
      for (let t = 0; t < pair.german.length; t += 1) {
        console.log(
          `    de ${String(pair.german[t].index).padStart(3)}  ${truncate(pair.german[t].text, 64)}`,
        )
        console.log(
          `    en ${String(pair.english[t].index).padStart(3)}  ${truncate(pair.english[t].text, 64)}`,
        )
      }
    }
  }
}

function sqlString(value: string | null): string {
  if (value === null) return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

// SQL rather than a direct write, exactly as importKeepers.ts does: the
// archive is the one thing in this project that cannot be regenerated,
// so the change gets read by a person before it is applied.
function toSql(row: DocumentRow, proposal: SplitProposal): string {
  return [
    `-- ${row.document_id}: ${row.title}`,
    `--   ${proposal.pairs.length} section pairs; the German half becomes a new row.`,
    'INSERT INTO Documents',
    '  (series_key, series_title, series_order, title, summary, content,',
    '   genre, tags, language, parallel_of, is_published)',
    'VALUES (',
    `  ${sqlString(row.series_key)}, ${sqlString(row.series_title)}, ${row.series_order ?? 'NULL'},`,
    // The German row mirrors the English title. It is never displayed --
    // the pair renders under one heading -- but a row called something
    // recognisable is far easier to work with in a database browser than
    // one called "Untitled".
    `  ${sqlString(row.title)},`,
    // No summary: the archive keeps one summary per work, in English, on
    // the row that appears in the Index of Texts.
    '  NULL,',
    `  ${sqlString(proposal.germanContent)},`,
    `  ${sqlString(row.genre)}, ${sqlString(row.tags)}, 'de', ${row.document_id}, 1`,
    ');',
    '',
    `UPDATE Documents SET`,
    `  content = ${sqlString(proposal.englishContent)},`,
    `  language = 'en'`,
    `WHERE document_id = ${row.document_id};`,
    '',
  ].join('\n')
}

if (has('candidates')) {
  listCandidates()
  process.exit(0)
}

const idsFlag = flag('ids')
if (!idsFlag) {
  console.error('Pass --ids=87,88 (or --candidates to find them).')
  process.exit(1)
}

const accepted = new Set(
  (flag('accept') ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n)),
)

const ids = idsFlag
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n))

const statement = db.prepare(
  `SELECT document_id, title, series_key, series_title, series_order,
          genre, tags, content, language, parallel_of
     FROM Documents WHERE document_id = ?`,
)

const sql: string[] = []
let clean = 0
let needsReview = 0

for (const id of ids) {
  const row = statement.get(id) as unknown as DocumentRow | undefined
  if (!row) {
    console.error(`\nNo document ${id}.`)
    continue
  }
  if (!row.content) {
    console.error(`\nDocument ${id} has no content.`)
    continue
  }

  const proposal = splitParallelText(row.content)
  report(row, proposal, has('full'))

  if (row.language !== null || row.parallel_of !== null) continue

  if (proposal.clean) {
    clean += 1
    sql.push(toSql(row, proposal))
  } else if (accepted.has(row.document_id) && proposal.pairs.length > 0) {
    console.log(`  accepted by hand (--accept=${row.document_id}).`)
    clean += 1
    sql.push(toSql(row, proposal))
  } else {
    needsReview += 1
  }
}

console.log(`\n${'='.repeat(78)}`)
console.log(`${clean} ready to write, ${needsReview} needing review.`)

const out = flag('out')
if (out) {
  if (sql.length === 0) {
    console.log('Nothing clean to write.')
  } else {
    // Only the clean ones. A document the splitter is unsure about is
    // precisely the one that should not be applied from a batch file
    // without someone having looked at it first.
    writeFileSync(
      out,
      [
        '-- Proposed parallel-text splits.',
        '-- Generated by scripts/splitParallelText.ts. Review before applying.',
        '--',
        '-- Apply with:  sqlite3 "$DB" < ' + out,
        '-- Back up first:  sqlite3 "$DB" ".backup \'/tmp/frau_erica.pre-split.db\'"',
        '',
        'PRAGMA foreign_keys = ON;',
        'BEGIN;',
        '',
        ...sql,
        'COMMIT;',
        '',
      ].join('\n'),
      'utf-8',
    )
    console.log(
      `Wrote ${sql.length} split(s) to ${out} -- review, then apply with sqlite3.`,
    )
  }
} else {
  console.log('Nothing written. Pass --out=splits.sql to emit SQL for the clean ones.')
}
