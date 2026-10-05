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
import { fixMojibake } from './fixMojibake.ts'
import { validateParallelTexts } from './parallelTextValidation.ts'

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

// Who appears in each photograph, from ImageLinks.person_id.
//
// Distinct from GalleryLinks.person_id, which says whose gallery this
// IS -- a gallery is about someone even in the photographs they are not
// in. The two are unioned for the "people in this gallery" list; the
// per-photograph names come from here alone.
//
// Filled in by the tagging tool at /admin/tag-photos and applied with
// scripts/reviewPhotoTags.ts. Six rows carried a person before that
// existed; everything beyond that is hand-tagged.
interface ImagePersonRow {
  image_id: number
  person_id: number
}
const imagePersonRows = db
  .prepare(`SELECT image_id, person_id FROM ImageLinks WHERE person_id IS NOT NULL`)
  .all() as unknown as ImagePersonRow[]

const personIdsByImage = new Map<number, number[]>()
for (const row of imagePersonRows) {
  personIdsByImage.set(row.image_id, [
    ...(personIdsByImage.get(row.image_id) ?? []),
    row.person_id,
  ])
}

// personIds on every published image, not just the ones in a gallery.
//
// 263 published photographs sit outside any gallery -- 171 header
// images and 92 others -- and the tagging tool reaches them through two
// synthetic groups built from this file. Without the tags here, that
// tool could not tell which of them were already done.
const imagesWithPeople = images.map((img) => ({
  ...img,
  personIds: personIdsByImage.get(img.image_id) ?? [],
}))

await writeJson('images.json', imagesWithPeople)

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
  author: string | null
  author_person_id: number | null
  language: string | null
  parallel_of: number | null
}

const documentRows = (
  db
    .prepare(
      `SELECT document_id, series_key, series_title, series_order, title,
              summary, content, genre, tags, author, author_person_id,
              language, parallel_of
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

// author is now real data, and is emitted. It was hardcoded null here
// on the grounds that no document had one (0/227 at the time), which
// was true until the Chicago Memoirs were given one -- at which point
// setting it in the database had no visible effect whatsoever, because
// this file threw it away on the way out. TextByline could already
// render a plain author string; it had simply never been handed one.
//
// authorPersonId is emitted too, as of migration 004. It names the
// author's Persons record where they have one, which is what lets
// TextByline take its nicer branch -- the author's name as a link to
// their family page -- instead of printing plain text. Most documents
// keep a null here and always will: much of this archive was written by
// people with no record in it.
//
// Not resolved by matching the author string to a name. The name does
// not identify anybody: 97 first-and-last-name pairs in this archive are
// shared by two or more people, six of them Paul Mueller. And the
// family's own words for its authors -- "Nana", "Opa", "Tante Fieks" --
// look nothing like the names in Persons. The id is recorded in the
// archive deliberately, one document at a time.
// Parallel texts are checked before anything is written. See
// parallelTextValidation.ts for why this is fatal rather than a warning:
// the site pairs the two halves by position, so a pair that has drifted
// by one paragraph renders happily and sets every paragraph after it
// against the wrong translation.
//
// Validated against every published row, since a pair whose halves
// disagree about publication is itself one of the faults being looked
// for.
const parallelCheck = validateParallelTexts(
  documentRows.map((row) => ({
    document_id: row.document_id,
    title: row.title,
    content: row.content,
    summary: row.summary,
    language: row.language,
    parallel_of: row.parallel_of,
    is_published: 1,
  })),
)
for (const warning of parallelCheck.warnings) {
  console.warn(`  parallel text: ${warning}`)
}
if (parallelCheck.errors.length > 0) {
  console.error('\nParallel-text validation failed, so nothing was exported:\n')
  for (const error of parallelCheck.errors) console.error(`  - ${error}`)
  console.error('')
  process.exit(1)
}

const documentsDetail = documentRows.map((row) => ({
  document_id: row.document_id,
  series_key: row.series_key,
  series_title: row.series_title,
  series_order: row.series_order,
  title: row.title,
  author: fixMojibake(row.author),
  authorPersonId: row.author_person_id,
  summary: row.summary,
  genre: row.genre,
  tags: row.tags,
  content: row.content ?? '',
  language: row.language,
  parallel_of: row.parallel_of,
  ...headerFor(row.document_id),
}))

// One entry per work, not per row. The translated half is a satellite:
// it has no summary of its own and would appear in the Index of Texts
// as a duplicate of the work it belongs to, under the same title. It
// stays in documents.json (so its own URL still resolves, and so the
// pair can be rendered from either id) but out of every list.
const documentsList = documentRows
  .filter((row) => row.parallel_of === null)
  .map((row) => ({
    document_id: row.document_id,
    series_key: row.series_key,
    series_title: row.series_title,
    series_order: row.series_order,
    title: row.title,
    author: fixMojibake(row.author),
    authorPersonId: row.author_person_id,
    summary: row.summary,
    genre: row.genre,
    tags: row.tags,
    language: row.language,
  }))

// ---------- Series (the collections texts are gathered into) ----------

interface SeriesRow {
  series_key: string
  slug: string
  name: string
  kind: string
  blurb: string | null
  cover_image_url: string | null
  sort_key: string | null
}

const seriesRows = db
  .prepare(
    `SELECT series_key, slug, name, kind, blurb, cover_image_url, sort_key
       FROM Series`,
  )
  .all() as unknown as SeriesRow[]

// Every series_key a published document claims must have a Series row,
// or that document's chapters would render under no collection at all
// and simply vanish from the shelf. Fatal, because the alternative is a
// text nobody can find.
const knownSeriesKeys = new Set(seriesRows.map((row) => row.series_key))
const orphanedKeys = [
  ...new Set(
    documentRows
      .filter((row) => row.series_key && !knownSeriesKeys.has(row.series_key))
      .map((row) => row.series_key as string),
  ),
]
if (orphanedKeys.length > 0) {
  console.error('\nPublished documents claim a series with no Series row:\n')
  for (const key of orphanedKeys) console.error(`  - ${key}`)
  console.error('\nAdd a row to Series, or clear series_key on those documents.\n')
  process.exit(1)
}

// Chapters counted from the EXPORTED, entry-point documents only: the
// German half of a parallel text is not a chapter of its own, and an
// unpublished chapter is not on the shelf.
const chapterCounts = new Map<string, number>()
for (const row of documentRows) {
  if (!row.series_key || row.parallel_of !== null) continue
  chapterCounts.set(row.series_key, (chapterCounts.get(row.series_key) ?? 0) + 1)
}

// The cover falls back to a chapter's header image, which is why this
// ships with covers on day one: every document has one (see
// DEFAULT_HEADER_IMAGE_URL above). A real cover set later in
// Series.cover_image_url always wins.
//
// Two rules beyond "take the first chapter's", because a shelf of cards
// is judged on its pictures and the naive version put the same photo on
// two cards three times over:
//
//   1. Skip the archive-wide default. It is the image a document gets
//      when it has none of its own, so it is nobody's cover in
//      particular -- and it put the same green field on the Christmas
//      letters and on Fritz's journal.
//   2. Don't repeat a cover already taken. Collections are processed
//      biggest first, so the ones most likely to be looked at get first
//      pick of the distinctive images, and a small collection falls
//      back to a repeat only when it has nothing else.
const chaptersByKey = new Map<string, number[]>()
for (const row of [...documentRows].sort(
  (a, b) => (a.series_order ?? 0) - (b.series_order ?? 0),
)) {
  if (!row.series_key || row.parallel_of !== null) continue
  const list = chaptersByKey.get(row.series_key) ?? []
  list.push(row.document_id)
  chaptersByKey.set(row.series_key, list)
}

const shelved = seriesRows
  // A collection with nothing published in it is not a collection yet.
  // The row stays in the archive so it is named when its texts are
  // published; it just isn't shipped.
  .filter((row) => (chapterCounts.get(row.series_key) ?? 0) > 0)
  // Biggest first, so the shelf opens on the works someone is most
  // likely to have come for -- twenty-eight Christmas letters and a
  // twenty-chapter memoir, not whichever collection starts with A.
  // Alphabetical put Adelheid, Alida and Fred Knief in the index's
  // six-card preview while Nana's memoir sat below the fold. An
  // explicit sort_key still wins where the Archivist sets one.
  .sort((a, b) => {
    if (a.sort_key || b.sort_key) {
      return (a.sort_key ?? '\uffff').localeCompare(b.sort_key ?? '\uffff')
    }
    const size =
      (chapterCounts.get(b.series_key) ?? 0) - (chapterCounts.get(a.series_key) ?? 0)
    return size !== 0 ? size : a.name.localeCompare(b.name)
  })

const takenCovers = new Set<string>()

function coverFor(seriesKey: string, explicit: string | null): string | null {
  if (explicit) return explicit

  const headers = (chaptersByKey.get(seriesKey) ?? []).map(
    (id) => headerFor(id).header_image_url,
  )
  const usable = headers.filter(
    (url): url is string => url !== null && url !== DEFAULT_HEADER_IMAGE_URL,
  )

  const unused = usable.find((url) => !takenCovers.has(url))
  const chosen = unused ?? usable[0] ?? headers[0] ?? null
  if (chosen) takenCovers.add(chosen)
  return chosen
}

const collections = shelved.map((row) => ({
  series_key: row.series_key,
  slug: row.slug,
  name: fixMojibake(row.name),
  kind: row.kind,
  blurb: fixMojibake(row.blurb),
  cover_image_url: coverFor(row.series_key, row.cover_image_url),
  chapterCount: chapterCounts.get(row.series_key) ?? 0,
}))

await writeJson('collections.json', collections)

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
        personIds: personIdsByImage.get(img.image_id) ?? [],
      }))

    // The union: whose gallery this is, PLUS everyone tagged in any of
    // its photographs. The page's heading promises "people in this
    // gallery", and before the per-photograph tags existed it could only
    // deliver "whose gallery this is" -- which is how a photograph of
    // Anson and Mark listed only Anson.
    const linkedPersonIds = [
      ...new Set([
        ...galleryLinkRows
          .filter((gl) => gl.gallery_id === gallery.gallery_id && gl.person_id != null)
          .map((gl) => gl.person_id as number),
        ...photos.flatMap((photo) => photo.personIds),
      ]),
    ]

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
console.log(`  documents:         ${documentsDetail.length} (published)
  collections:       ${collections.length} (with >=1 published text)`)
console.log(`  galleries:         ${galleries.length} (with >=1 published photo)`)
console.log(`  lexicon:           ${lexicon.length}`)
console.log(`  persons:           ${persons.length}`)
console.log(`  images (internal): ${images.length} (published)`)
