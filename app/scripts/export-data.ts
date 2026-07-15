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

const images = db
  .prepare(
    `SELECT image_id, title, caption, credit, year_taken, location, width, height, url
     FROM Images WHERE is_published = 1`,
  )
  .all() as unknown as ImageRow[]

await writeJson('images.json', images)

const imagesById = new Map(images.map((img) => [img.image_id, img]))

// ---------- Persons (encoding-fix re-export -- Persons/data-access wiring itself is out of scope) ----------

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

// middle_name/suffix are coerced null -> '' to match the existing Person
// type's non-nullable string fields (mockPersons.ts, unchanged this pass --
// Persons/data-access restructuring is out of scope).
const persons = personRows.map((p) => ({
  ...p,
  middle_name: p.middle_name ?? '',
  suffix: p.suffix ?? '',
}))

await writeJson('persons.json', persons)

// ---------- Lexicon ----------

const lexicon = db
  .prepare(`SELECT term, pronunciation, part_of_speech, definition FROM Lexicon`)
  .all()

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

const documentRows = db
  .prepare(
    `SELECT document_id, series_key, series_title, series_order, title,
            summary, content, genre, tags
     FROM Documents WHERE is_published = 1`,
  )
  .all() as unknown as DocumentRow[]

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
      name: gallery.name,
      summary: gallery.summary ?? '',
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
