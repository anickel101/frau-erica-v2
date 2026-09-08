// Reads the real Frau Erica SQLite database and writes public-safe JSON
// into src/data/generated/. Run from app/: `npm run export-data`.
//
// The generated files are committed to git (public content is meant to be
// publicly visible once deployed anyway, and this keeps `npm run build`
// working on any checkout without the real database mounted) -- review
// what changed with `git diff` after every run, same as any other commit.
//
// DB path resolves: --db=<path> flag > FRAU_ERICA_DB_PATH env var > the
// hardcoded default below (this is a personal-machine authoring tool, not
// CI infrastructure).

import { DatabaseSync } from 'node:sqlite'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../src/data/generated')

const DEFAULT_DB_PATH =
  '/Users/ansonnickel/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db'

function resolveDbPath(): string {
  const flagArg = process.argv.find((a) => a.startsWith('--db='))
  if (flagArg) return flagArg.slice('--db='.length)
  if (process.env.FRAU_ERICA_DB_PATH) return process.env.FRAU_ERICA_DB_PATH
  return DEFAULT_DB_PATH
}

const dbPath = resolveDbPath()
if (!existsSync(dbPath)) {
  console.error(`Database not found at: ${dbPath}`)
  console.error('Pass --db=<path> or set FRAU_ERICA_DB_PATH to override.')
  process.exit(1)
}

const db = new DatabaseSync(dbPath, { readOnly: true })

// Old FileMaker/Word-authored text occasionally carries UTF-8 curly-quote
// or dash bytes that got re-interpreted as MacRoman somewhere in this
// project's editing history (BBEdit, most likely) -- a real ’ round-trips
// to ‚Äô, an em dash to ‚Äî, etc. (confirmed against the real export: e.g.
// "Molly‚Äôs wedding" instead of "Molly's wedding"). Idempotent -- these
// exact byte sequences don't occur in ordinary prose, so running this on
// already-clean text is a no-op. Applied at export time (not just a
// one-off fix to the committed JSON) so this doesn't quietly reappear the
// next time someone re-runs this script against the real database, since
// the underlying FileMaker-era text field itself isn't being touched.
function fixMojibake(text: string): string
function fixMojibake(text: string | null): string | null
function fixMojibake(text: string | null): string | null {
  if (text === null) return null
  return text
    .replaceAll('‚Äô', '’') // ’
    .replaceAll('‚Äì', '–') // –
    .replaceAll('‚Äî', '—') // —
    .replaceAll('‚Äò', '‘') // ‘
    .replaceAll('‚Äú', '“') // “
    .replaceAll('‚Äù', '”') // ”
}

async function writeJson(filename: string, data: unknown): Promise<void> {
  // Formatted through Prettier's own API (not just JSON.stringify) so the
  // output always already satisfies `npm run format:check` -- Prettier's
  // JSON printer collapses short arrays onto one line, which a plain
  // indent-by-level stringify doesn't replicate.
  const outPath = path.join(OUTPUT_DIR, filename)
  const formatted = await prettier.format(JSON.stringify(data), {
    filepath: outPath,
  })
  writeFileSync(outPath, formatted, 'utf8')
}

// ---------- Images (internal lookup: {{image:ID}} resolution + gallery photos) ----------

interface ImageRow {
  image_id: number
  title: string | null
  caption: string | null
  credit: string | null
  year_taken: number | null
  location: string | null
  width: number | null
  height: number | null
  url: string
}

const images = (
  db
    .prepare(
      `SELECT image_id, title, caption, credit, year_taken, location, width, height, url
       FROM Images WHERE is_published = 1`,
    )
    .all() as unknown as ImageRow[]
).map((img) => ({
  ...img,
  title: fixMojibake(img.title),
  caption: fixMojibake(img.caption),
  credit: fixMojibake(img.credit),
  location: fixMojibake(img.location),
}))

await writeJson('images.json', images)

const imagesById = new Map(images.map((img) => [img.image_id, img]))

// ---------- Persons ----------

interface PersonRow {
  person_id: number
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  date_of_birth: string | null
  birth_year: number | null
  date_of_death: string | null
  death_year: number | null
}

const personRows = db
  .prepare(
    `SELECT person_id, first_name, middle_name, last_name, suffix,
            date_of_birth, birth_year, date_of_death, death_year
     FROM Persons`,
  )
  .all() as unknown as PersonRow[]

// linkedFamilyId: which family page this person's Index-of-Persons entry
// should link to -- their own partner family (lowest family_id if more
// than one) if they have one, else the family they appear in as a
// child. Same resolution api/src/lib/queries/families.ts's
// resolveLinkedFamilyId does live for Family pages, reimplemented here
// over the full Relationships/Families tables in plain JS (small,
// ~1,300 persons) rather than a per-person query loop -- this is a
// batch export, not a live request. Not shared code with api/: app/ and
// api/ are deliberately separate dependency trees on different SQLite
// bindings (node:sqlite here, sql.js there).
interface FamilyLinkRow {
  family_id: number
  person_id_1: number | null
  person_id_2: number | null
}

const familyLinkRows = db
  .prepare('SELECT family_id, person_id_1, person_id_2 FROM Families')
  .all() as unknown as FamilyLinkRow[]

const partnerFamiliesByPerson = new Map<number, number[]>()
for (const f of familyLinkRows) {
  for (const personId of [f.person_id_1, f.person_id_2]) {
    if (personId === null) continue
    const existing = partnerFamiliesByPerson.get(personId)
    if (existing) existing.push(f.family_id)
    else partnerFamiliesByPerson.set(personId, [f.family_id])
  }
}

interface ParentLinkRow {
  person_id_1: number // parent
  person_id_2: number // child
}

const parentLinkRows = db
  .prepare(
    `SELECT person_id_1, person_id_2 FROM Relationships
     WHERE relationship_type IN ('biological_parent', 'step_parent', 'adoptive_parent')`,
  )
  .all() as unknown as ParentLinkRow[]

const parentsByChild = new Map<number, number[]>()
for (const r of parentLinkRows) {
  const existing = parentsByChild.get(r.person_id_2)
  if (existing) existing.push(r.person_id_1)
  else parentsByChild.set(r.person_id_2, [r.person_id_1])
}

function resolveLinkedFamilyId(personId: number): number | null {
  const partnerFamilies = partnerFamiliesByPerson.get(personId)
  if (partnerFamilies && partnerFamilies.length > 0) {
    return Math.min(...partnerFamilies)
  }
  const parentIds = parentsByChild.get(personId) ?? []
  const parentFamilies = parentIds.flatMap((id) => partnerFamiliesByPerson.get(id) ?? [])
  return parentFamilies.length > 0 ? Math.min(...parentFamilies) : null
}

// middle_name/suffix are coerced null -> '' to match the existing Person
// type's non-nullable string fields.
const persons = personRows.map((p) => ({
  ...p,
  first_name: fixMojibake(p.first_name),
  middle_name: fixMojibake(p.middle_name ?? ''),
  last_name: fixMojibake(p.last_name),
  suffix: fixMojibake(p.suffix ?? ''),
  linkedFamilyId: resolveLinkedFamilyId(p.person_id),
}))

await writeJson('persons.json', persons)

// ---------- Lexicon ----------

interface LexiconRow {
  term: string
  pronunciation: string | null
  part_of_speech: string | null
  definition: string | null
}

const lexicon = (
  db
    .prepare(`SELECT term, pronunciation, part_of_speech, definition FROM Lexicon`)
    .all() as unknown as LexiconRow[]
).map((row) => ({
  term: fixMojibake(row.term),
  pronunciation: fixMojibake(row.pronunciation),
  part_of_speech: fixMojibake(row.part_of_speech),
  definition: fixMojibake(row.definition),
}))

await writeJson('lexicon.json', lexicon)

// ---------- Documents ----------

interface DocumentRow {
  document_id: number
  series_key: string | null
  series_title: string | null
  series_order: number | null
  title: string
  summary: string | null
  content: string | null
  genre: string | null
  tags: string | null
}

const documentRows = (
  db
    .prepare(
      `SELECT document_id, series_key, series_title, series_order, title,
              summary, content, genre, tags
       FROM Documents WHERE is_published = 1`,
    )
    .all() as unknown as DocumentRow[]
).map((row) => ({
  ...row,
  series_title: fixMojibake(row.series_title),
  title: fixMojibake(row.title),
  summary: fixMojibake(row.summary),
  content: fixMojibake(row.content),
}))

// Header images for text pages. Opa asked that every text file have one,
// as Family pages do, with hdr.MuellerFarm2.jpg as the fallback.
//
// The data was almost all there already: 124 of the 155 published
// documents have a published image linked whose filename begins "hdr."
// -- the archive's own long-standing convention for a header photo, the
// same one Family pages rely on. Only the remaining 31 need the default.
//
// ORDER BY image_id so the one document with two candidate headers
// (document 75) resolves the same way on every export rather than
// however SQLite happened to return the rows.
const DEFAULT_HEADER_IMAGE_URL = 'hdr.MuellerFarm2.jpg'

interface DocumentHeaderRow {
  document_id: number
  url: string
  caption: string | null
}

const documentHeaderRows = db
  .prepare(
    `SELECT il.document_id, i.url, i.caption
       FROM ImageLinks il
       JOIN Images i ON i.image_id = il.image_id
      WHERE il.document_id IS NOT NULL
        AND i.is_published = 1
        AND i.url LIKE 'hdr%'
      ORDER BY i.image_id`,
  )
  .all() as unknown as DocumentHeaderRow[]

const headerByDocumentId = new Map<number, { url: string; caption: string | null }>()
for (const row of documentHeaderRows) {
  if (!headerByDocumentId.has(row.document_id)) {
    headerByDocumentId.set(row.document_id, { url: row.url, caption: row.caption })
  }
}

// The fallback's caption is read from the Images row rather than written
// here, so the wording stays owned by the archive -- it already reads
// exactly as Opa specified it.
const defaultHeader = db
  .prepare(`SELECT url, caption FROM Images WHERE url = ? AND is_published = 1`)
  .get(DEFAULT_HEADER_IMAGE_URL) as { url: string; caption: string | null } | undefined

function headerFor(documentId: number) {
  const header = headerByDocumentId.get(documentId) ?? defaultHeader
  return {
    header_image_url: header?.url ?? null,
    header_image_caption: fixMojibake(header?.caption ?? null),
  }
}

// Documents.author is unused in real data (verified: 0/227 non-null) and
// there's no reliable author -> person linkage anywhere in the schema
// (DocumentLinks has only 6 rows and doesn't distinguish "author" from
// "subject" anyway) -- both fields are kept in the shape for forward
// compatibility, always null for now.
const documentsDetail = documentRows.map((row) => ({
  document_id: row.document_id,
  series_key: row.series_key,
  series_title: row.series_title,
  series_order: row.series_order,
  title: row.title,
  author: null as string | null,
  authorPersonId: null as number | null,
  summary: row.summary,
  genre: row.genre,
  tags: row.tags,
  content: row.content ?? '',
  ...headerFor(row.document_id),
}))

const documentsList = documentRows.map((row) => ({
  document_id: row.document_id,
  series_key: row.series_key,
  series_title: row.series_title,
  series_order: row.series_order,
  title: row.title,
  author: null as string | null,
  authorPersonId: null as number | null,
  summary: row.summary,
  genre: row.genre,
  tags: row.tags,
}))

await writeJson('documents.json', documentsDetail)
await writeJson('documents-list.json', documentsList)

// ---------- Galleries ----------

interface GalleryRow {
  gallery_id: number
  name: string
  summary: string | null
  lead_image_id: number | null
}

const galleryRows = db
  .prepare(`SELECT gallery_id, name, summary, lead_image_id FROM Galleries`)
  .all() as unknown as GalleryRow[]

interface GalleryImageRow {
  gallery_id: number
  image_id: number
}

const galleryImageRows = db
  .prepare(`SELECT gallery_id, image_id FROM GalleryImages ORDER BY sort_order`)
  .all() as unknown as GalleryImageRow[]

interface GalleryLinkRow {
  gallery_id: number
  person_id: number | null
}

const galleryLinkRows = db
  .prepare(`SELECT gallery_id, person_id FROM GalleryLinks`)
  .all() as unknown as GalleryLinkRow[]

const galleries = galleryRows
  .map((gallery) => {
    const photos = galleryImageRows
      .filter((gi) => gi.gallery_id === gallery.gallery_id)
      .map((gi) => imagesById.get(gi.image_id))
      .filter((img): img is ImageRow => img !== undefined)
      .map((img) => ({
        image_id: img.image_id,
        title: img.title ?? '',
        caption: img.caption ?? '',
        credit: img.credit ?? '',
        year_taken: img.year_taken,
        location: img.location ?? '',
        width: img.width ?? 0,
        height: img.height ?? 0,
        url: img.url,
      }))

    const linkedPersonIds = galleryLinkRows
      .filter((gl) => gl.gallery_id === gallery.gallery_id && gl.person_id != null)
      .map((gl) => gl.person_id as number)

    return {
      gallery_id: gallery.gallery_id,
      name: fixMojibake(gallery.name),
      summary: fixMojibake(gallery.summary ?? ''),
      lead_image_id: gallery.lead_image_id ?? photos[0]?.image_id ?? 0,
      photos,
      linkedPersonIds,
    }
  })
  // A gallery with nothing visible publicly is useless publicly -- this is
  // a derived filter (Galleries itself has no is_published column).
  .filter((gallery) => gallery.photos.length > 0)

await writeJson('galleries.json', galleries)

db.close()

console.log('Export complete:')
console.log(`  documents:         ${documentsDetail.length} (published)`)
console.log(`  galleries:         ${galleries.length} (with >=1 published photo)`)
console.log(`  lexicon:           ${lexicon.length}`)
console.log(`  persons:           ${persons.length}`)
console.log(`  images (internal): ${images.length} (published)`)
