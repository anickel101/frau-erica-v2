// Imports the Keepers cookbook into the archive database. Run from app/:
//
//   node scripts/importKeepers.ts --review      # print the parse, write nothing
//   node scripts/importKeepers.ts --out=k.sql   # write INSERT statements
//
// --review is the default and the point: 55 hand-written PHP pages
// spanning a decade of evolving conventions do not parse perfectly on
// the first try, and the failure mode to avoid is loading a plausible-
// looking but wrong recipe into the database. Nothing is written unless
// --out is passed, and the report flags every recipe the parser is
// unsure about.
//
// Re-runnable: it emits a self-contained SQL file that clears the four
// Recipe tables and rebuilds them, so correcting a source page and
// re-importing is cheap. It does NOT connect to the database itself --
// review the SQL, then apply it with sqlite3.
//
// Source paths default to the archivist's own layout and can be
// overridden, same convention as export-data.ts.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fixMojibake } from './fixMojibake.ts'
import type { IndexEntry, ParsedRecipe } from './keepersParser.ts'
import { parseIndex, parseRecipe } from './keepersParser.ts'

const DEFAULT_ROOT = '/Users/ansonnickel/Anson/Code/FrauErica/non-git_resources'

function flag(name: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`))
  return found?.slice(name.length + 3)
}

const root = flag('root') ?? process.env.FRAU_ERICA_LEGACY_ROOT ?? DEFAULT_ROOT
const KEEPERS_DIR = path.join(root, 'Keepers_legacy')
const TEXT_DIR = path.join(root, '7-5-26_Exports/Text')
const IMAGES_DIR = path.join(root, '7-5-26_Exports/Images')

for (const dir of [KEEPERS_DIR, TEXT_DIR]) {
  if (!existsSync(dir)) {
    console.error(`Not found: ${dir}`)
    console.error('Pass --root=<path> or set FRAU_ERICA_LEGACY_ROOT.')
    process.exit(1)
  }
}

// The archive-wide fallback, same value export-data.ts uses for the 31
// documents with no header of their own.
const DEFAULT_HEADER_IMAGE = 'hdr.MuellerFarm2.jpg'

// Files in Keepers_legacy/ that are not recipes.
const NOT_RECIPES = new Set(['MollyFruitcake copy.php'])

// The four [Heirloom] entries: two-line PHP redirects in Keepers/ whose
// real content lives in Text/ under a different name. Opa's naming
// conventions evolved over decades -- these mappings were confirmed with
// him directly, not guessed.
const HEIRLOOMS: Record<string, { file: string; title?: string }> = {
  'Eierschwer.php': { file: 'FrauErica4.php' },
  'Heppen.php': { file: 'Heppen.php' },
  'JohannImSack.php': { file: 'FrauErica1.php' },
  'MollyFruitcake.php': { file: 'MollyFruitcake.php' },
}

// Recipes that were never added to _arrayKeepers.php and so were
// unreachable on the old site. They import unpublished; Opa flips them.
const UNINDEXED: Record<string, { title?: string; genre?: string; header?: string }> = {
  'ColdOats.php': { genre: 'Bakery / Desserts' },
  // The page's own <p class="head24"> is a copy-paste of "Pickled Sweet
  // Pepper Strips" -- the file was cloned and the headline never
  // updated. Opa supplied the real name: a pun on pesto, a basil sauce
  // ready before the pasta finishes boiling. Do not "correct" it.
  'PestoPasta.php': {
    title: 'Presto Pasta',
    genre: 'Main Dishes',
    header: 'hdr.Basil.jpg',
  },
  'PickledSweetPeppers.php': { genre: 'Vegetables / Sides' },
  'Sauerbraten.php': { genre: 'Main Dishes' },
}

// ---------------------------------------------------------------------

const indexEntries = parseIndex(
  readFileSync(path.join(KEEPERS_DIR, '_arrayKeepers.php'), 'utf8'),
)
const indexByUrl = new Map<string, IndexEntry>(indexEntries.map((e) => [e.url, e]))

function read(dir: string, file: string): string {
  return fixMojibake(readFileSync(path.join(dir, file), 'utf8'))
}

const recipes: ParsedRecipe[] = []

for (const file of readdirSync(KEEPERS_DIR)
  .filter((f) => f.endsWith('.php'))
  .sort()) {
  if (file.startsWith('_') || NOT_RECIPES.has(file)) continue

  const heirloom = HEIRLOOMS[file]
  const unindexed = UNINDEXED[file]
  const indexEntry = indexByUrl.get(file)

  const php = heirloom ? read(TEXT_DIR, heirloom.file) : read(KEEPERS_DIR, file)

  recipes.push(
    parseRecipe(php, {
      indexEntry,
      dialect: heirloom ? 'text' : 'keepers',
      titleOverride: unindexed?.title ?? heirloom?.title,
      genreOverride: unindexed?.genre,
      headerImageOverride: unindexed?.header,
      // The 50 indexed recipes were public on the old site. The four
      // unindexed ones were not, so they start hidden.
      isPublished: Boolean(indexEntry),
    }),
  )
}

// ---------------------------------------------------------------------
// Review report
// ---------------------------------------------------------------------

function reportLine(recipe: ParsedRecipe): string {
  const ingredients = recipe.sections.reduce((n, s) => n + s.ingredients.length, 0)
  const steps = recipe.sections.reduce((n, s) => n + s.steps.length, 0)
  const marks = [
    recipe.bilingual ? 'BILINGUAL' : '',
    recipe.isPublished ? '' : 'unpublished',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    `  ${recipe.title.slice(0, 42).padEnd(44)}` +
    `${(recipe.genre ?? '—').padEnd(20)}` +
    `${String(recipe.sections.length).padStart(2)} sec ` +
    `${String(ingredients).padStart(3)} ingr ` +
    `${String(steps).padStart(3)} step  ${marks}`
  )
}

console.log(`\nParsed ${recipes.length} recipes from ${KEEPERS_DIR}\n`)
console.log(`  ${'TITLE'.padEnd(44)}${'GENRE'.padEnd(20)}COUNTS`)
console.log(`  ${'-'.repeat(86)}`)
for (const recipe of recipes) console.log(reportLine(recipe))

const flagged = recipes.filter((r) => r.warnings.length > 0)
console.log(`\n${flagged.length} of ${recipes.length} recipes need a look:\n`)
for (const recipe of flagged) {
  console.log(`  ${recipe.title || '(untitled)'}`)
  for (const warning of recipe.warnings) console.log(`      - ${warning}`)
}

// Header images, and whether the file is actually on disk in either
// folder -- a missing one silently becomes the default otherwise.
const headers = new Map<string, number>()
for (const recipe of recipes) {
  const image = recipe.headerImage ?? DEFAULT_HEADER_IMAGE
  headers.set(image, (headers.get(image) ?? 0) + 1)
}
const missing = [...headers.keys()].filter(
  (image) =>
    image !== DEFAULT_HEADER_IMAGE &&
    !existsSync(path.join(KEEPERS_DIR, image)) &&
    !existsSync(path.join(IMAGES_DIR, image)),
)
console.log(`\n${headers.size} distinct header images across ${recipes.length} recipes`)
console.log(`  not found on disk: ${missing.length ? missing.join(', ') : 'none'}`)

const slugs = new Map<string, string[]>()
for (const recipe of recipes) {
  slugs.set(recipe.slug, [...(slugs.get(recipe.slug) ?? []), recipe.title])
}
const collisions = [...slugs.entries()].filter(([, titles]) => titles.length > 1)
console.log(
  `  slug collisions  : ${collisions.length ? JSON.stringify(collisions) : 'none'}`,
)

// ---------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------

function quote(value: string | null): string {
  if (value === null || value === '') return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

function toSql(): string {
  const lines: string[] = [
    '-- Generated by app/scripts/importKeepers.ts. Do not edit by hand.',
    '-- Re-runnable: clears the four Recipe tables and rebuilds them.',
    'PRAGMA foreign_keys = ON;',
    'BEGIN TRANSACTION;',
    'DELETE FROM RecipeIngredients;',
    'DELETE FROM RecipeSteps;',
    'DELETE FROM RecipeSections;',
    'DELETE FROM Recipes;',
    '',
  ]

  recipes.forEach((recipe, recipeIndex) => {
    const recipeId = recipeIndex + 1
    const image = recipe.headerImage ?? DEFAULT_HEADER_IMAGE
    lines.push(`-- ${recipe.title}`)
    lines.push(
      'INSERT INTO Recipes (recipe_id, slug, title, genre, summary, header_image_id, ' +
        'source_note, is_published) VALUES (' +
        [
          recipeId,
          quote(recipe.slug),
          quote(recipe.title),
          quote(recipe.genre),
          quote(recipe.summary),
          // Resolved by filename against the real Images table rather
          // than hardcoded: these photos are being inserted as ordinary
          // Images rows by the same migration.
          `(SELECT image_id FROM Images WHERE url = ${quote(image)} LIMIT 1)`,
          quote(recipe.sourceNote),
          recipe.isPublished ? 1 : 0,
        ].join(', ') +
        ');',
    )

    recipe.sections.forEach((section, sectionIndex) => {
      const sectionId = recipeId * 100 + sectionIndex + 1
      lines.push(
        'INSERT INTO RecipeSections (section_id, recipe_id, label, sort_order) VALUES (' +
          `${sectionId}, ${recipeId}, ${quote(section.label)}, ${section.sortOrder});`,
      )
      for (const ingredient of section.ingredients) {
        lines.push(
          'INSERT INTO RecipeIngredients (section_id, text, column_no, lang, sort_order) VALUES (' +
            `${sectionId}, ${quote(ingredient.text)}, ${ingredient.columnNo}, ` +
            `${quote(ingredient.lang)}, ${ingredient.sortOrder});`,
        )
      }
      for (const step of section.steps) {
        lines.push(
          'INSERT INTO RecipeSteps (section_id, body, lang, sort_order) VALUES (' +
            `${sectionId}, ${quote(step.body)}, ${quote(step.lang)}, ${step.sortOrder});`,
        )
      }
    })
    lines.push('')
  })

  lines.push('COMMIT;')
  return lines.join('\n')
}

const outPath = flag('out')
if (outPath) {
  writeFileSync(outPath, toSql(), 'utf8')
  console.log(`\nWrote SQL to ${outPath}`)
  console.log('Review it, then apply with:  sqlite3 <db> < ' + outPath)
} else {
  console.log(
    '\nNo --out given, so nothing was written. Pass --out=keepers.sql to emit SQL.',
  )
}
