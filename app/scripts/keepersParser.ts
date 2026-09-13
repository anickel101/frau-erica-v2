// Parses the original Keepers cookbook out of its hand-written PHP
// pages. Pure functions only -- no filesystem, no database -- so the
// parsing rules can be tested against real markup without a database
// mounted. importKeepers.ts is the CLI that feeds this and writes SQL.
//
// There are TWO source dialects, and that is the main thing this module
// exists to absorb:
//
//   Keepers/   -- the cookbook proper. Ingredient blocks are fenced by
//                 literal `BEGIN INGREDIENTS` / `END INGREDIENTS` HTML
//                 comments; section labels are `text14` + <strong>.
//   Text/      -- four "[Heirloom]" recipes that lived with the essays.
//                 No fences at all: an ingredient list is a `text12`
//                 paragraph whose content is a run of <br>-separated
//                 short lines, and section labels are `text18`.
//
// An earlier pass over this archive concluded the Text/ pages had no
// ingredient lists, because it looked for the fences. They all do. That
// is why the dialect is detected rather than assumed.

export type Lang = 'de' | 'en' | null

export interface ParsedIngredient {
  text: string
  columnNo: 1 | 2
  lang: Lang
  sortOrder: number
}

export interface ParsedStep {
  body: string
  lang: Lang
  sortOrder: number
}

export interface ParsedSection {
  label: string | null
  sortOrder: number
  ingredients: ParsedIngredient[]
  steps: ParsedStep[]
}

export interface ParsedRecipe {
  slug: string
  title: string
  genre: string | null
  summary: string | null
  headerImage: string | null
  sourceNote: string | null
  isPublished: boolean
  bilingual: boolean
  sections: ParsedSection[]
  // Anything a human should look at before this row is trusted. Printed
  // by the CLI's review report; never silently swallowed.
  warnings: string[]
}

export interface IndexEntry {
  genre: string
  tag: string
  title: string
  summary: string
  url: string
}

// ---------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------

// Only the entities that actually occur in these files, plus the handful
// a 2012-era authoring habit makes likely. An unknown entity is left
// alone rather than mangled -- it shows up in the review report as
// literal text, which is a visible problem rather than a silent one.
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&#160;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&deg;': '°',
  '&frac12;': '½',
  '&frac14;': '¼',
  '&frac34;': '¾',
  '&#189;': '½',
  '&#188;': '¼',
  '&#190;': '¾',
  '&hellip;': '…',
}

function decodeEntities(text: string): string {
  return text.replace(/&[#a-zA-Z0-9]+;/g, (entity) => ENTITIES[entity] ?? entity)
}

// The source is HTML; Recipes stores markdown. Only <em> and <strong>
// carry meaning in this content -- everything else is layout scaffolding
// from a table-based 2012 page and is dropped.
export function htmlToMarkdown(html: string): string {
  return collapse(
    decodeEntities(
      html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\/?(?:em|i)\b[^>]*>/gi, '*')
        .replace(/<\/?(?:strong|b)\b[^>]*>/gi, '**')
        .replace(/<[^>]+>/g, ' '),
    ),
  )
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// German letters are transliterated the way German itself does it --
// ß to ss, umlauts to the vowel plus e -- not dropped. Several titles
// are German, and stripping the characters instead produced
// "gro-er-hefenklo" from "Großer Hefenkloß", which is neither readable
// nor guessable. "grosser-hefenkloss" is what a German speaker would
// write, and it keeps the word intact.
//
// Accented Latin elsewhere (Paté) decomposes to its base letter, which
// is the ordinary URL convention and loses nothing.
const TRANSLITERATIONS: [RegExp, string][] = [
  [/ß/g, 'ss'],
  [/ä/g, 'ae'],
  [/ö/g, 'oe'],
  [/ü/g, 'ue'],
]

export function slugify(title: string): string {
  let text = htmlToMarkdown(title).toLowerCase()
  for (const [pattern, replacement] of TRANSLITERATIONS) {
    text = text.replace(pattern, replacement)
  }
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------------
// _arrayKeepers.php -- the index
// ---------------------------------------------------------------------

// The whole array is on one line in the real file, so this is a flat
// scan for the four fields of each record rather than anything
// line-oriented.
export function parseIndex(php: string): IndexEntry[] {
  const entries: IndexEntry[] = []
  const RECORD =
    /'genre'\s*=>\s*"([^"]*)".*?'tag'\s*=>\s*"([^"]*)".*?'title'\s*=>\s*"([^"]*)".*?'summary'\s*=>\s*"([^"]*)".*?'URL'\s*=>\s*"([^"]*)"/gs
  for (const match of php.matchAll(RECORD)) {
    entries.push({
      genre: match[1].trim(),
      tag: htmlToMarkdown(match[2]),
      title: htmlToMarkdown(match[3]),
      summary: htmlToMarkdown(match[4]),
      url: match[5].trim(),
    })
  }
  return entries
}

// ---------------------------------------------------------------------
// Shared page-level fields
// ---------------------------------------------------------------------

function matchOne(source: string, pattern: RegExp): string | null {
  const match = source.match(pattern)
  return match ? match[1] : null
}

export function readHeaderImage(php: string): string | null {
  const value = matchOne(php, /\$headerFN\s*=\s*"([^"]*)"/)
  return value && value.trim() ? value.trim() : null
}

export function readPageTitle(php: string): string | null {
  const raw = matchOne(php, /<p class="head24">([\s\S]*?)<\/p>/)
  return raw ? htmlToMarkdown(raw) : null
}

export function readPageSummary(php: string): string | null {
  const raw = matchOne(php, /<p class="summary">([\s\S]*?)<\/p>/)
  return raw ? htmlToMarkdown(raw) : null
}

// `$columnset = 2` is the reliable signal for the three bilingual
// recipes from Frau Erica's 1903 Deutsch-Amerikanisches Kochbuch
// (Sauerbraten, Johann im Sack, Eierschwer) -- every other recipe uses
// 1, 4 or 6. Checked across all 55 source files.
export function isBilingual(php: string): boolean {
  return matchOne(php, /\$columnset\s*=\s*(\d)/) === '2'
}

// The five recipes that credit an outside source. Extracted at import
// time rather than typed in later; anything not matched leaves
// source_note NULL, which is the common case.
const SOURCE_PATTERNS: [RegExp, string][] = [
  [/James Beard/i, 'Adapted from a recipe attributed to James Beard'],
  [/New York Times/i, 'From the New York Times'],
  [/Minnesota Centennial/i, 'Adapted from the Minnesota Centennial Cookbook'],
  [
    /Deutsch-Amerikanisches Kochbuch/i,
    "From Frau Erica's Deutsch-Amerikanisches Kochbuch (Rundschau Publishing Co., Milwaukee and Chicago, 1903)",
  ],
  [/Cuisinart/i, 'From a Cuisinart publication'],
]

export function readSourceNote(text: string): string | null {
  for (const [pattern, note] of SOURCE_PATTERNS) {
    if (pattern.test(text)) return note
  }
  return null
}

// ---------------------------------------------------------------------
// Body: the Keepers dialect (fenced)
// ---------------------------------------------------------------------

const FENCE =
  /<!--\s*=*\s*BEGIN INGREDIENTS\s*=*\s*-->([\s\S]*?)<!--\s*=*\s*END INGREDIENTS\s*=*\s*-->/g

// Is this <p> an ingredient list rather than prose?
//
// The strong signal is `text-align:center` -- the original site styled
// every ingredient list that way and nothing else, which makes it a
// semantic marker rather than a guess. Anson's Beef relies on it
// entirely: its list is only three lines long (prime beef, salt and
// pepper, paper towels) and no line-count rule would ever catch it.
//
// The fallback, for the Text/ pages that don't centre, is four or more
// <br>-separated lines averaging under ~70 characters. Deliberately
// conservative: a false negative lands the lines in steps, where they
// are visible and easy to fix; a false positive shreds a paragraph into
// nonsense.
function looksLikeIngredientList(inner: string, attrs = ''): boolean {
  const lines = splitBrLines(inner)
  if (lines.length < 2) return false
  if (/text-align\s*:\s*center/i.test(attrs)) return true
  if (lines.length < 4) return false
  const average = lines.reduce((sum, line) => sum + line.length, 0) / lines.length
  return average < 70
}

// Comments are stripped BEFORE the split, not after. The source marks an
// empty second ingredient column with a commented-out placeholder that
// has a <br> inside it:
//
//   <p class="text12" style="text-align:center;">
//   <!--  ingredient<br>  -->
//   </p>
//
// Splitting first tears that into "<!--  ingredient" and "  -->", and
// neither fragment is well-formed markup any more, so tag-stripping
// leaves both as literal text. The result was two junk ingredients on
// every recipe with an unused second column -- visible on the printed
// page as "<!-- ingredient" and "-->" sitting in the ingredient list.
function splitBrLines(inner: string): string[] {
  return inner
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/<br\s*\/?>/i)
    .map((line) => htmlToMarkdown(line))
    .filter((line) => line.length > 0)
}

function ingredientsFromColumns(
  columns: string[],
  lang: Lang,
  startOrder: number,
): ParsedIngredient[] {
  const ingredients: ParsedIngredient[] = []
  let sortOrder = startOrder
  columns.forEach((column, index) => {
    // column_no is CONTENT, not layout: the split is frequently
    // semantic (Carrot Muffins puts wet in column 1 and dry in
    // column 2; Boeuf Bourguignon solids then liquids), and the
    // columns are uneven, which pure overflow would not produce.
    const columnNo: 1 | 2 = index === 0 ? 1 : 2
    for (const text of splitBrLines(column)) {
      ingredients.push({ text, columnNo, lang, sortOrder })
      sortOrder += 1
    }
  })
  return ingredients
}

function paragraphsOf(
  html: string,
  classes: string,
): { cls: string; attrs: string; inner: string }[] {
  const pattern = new RegExp(`<p\\s+class="(${classes})"([^>]*)>([\\s\\S]*?)<\\/p>`, 'g')
  const out: { cls: string; attrs: string; inner: string }[] = []
  for (const match of html.matchAll(pattern)) {
    out.push({ cls: match[1], attrs: match[2], inner: match[3] })
  }
  return out
}

// Strips everything before the title and after the closing PHP block, so
// the template's own boilerplate can't be mistaken for content.
function bodyOf(php: string): string {
  const start = php.indexOf('<p class="head24">')
  const end = php.lastIndexOf('<?php')
  if (start === -1) return php
  return php.slice(start, end > start ? end : undefined)
}

function parseFencedBody(php: string): ParsedSection[] {
  const body = bodyOf(php)
  const sections: ParsedSection[] = []
  const fences = [...body.matchAll(FENCE)]

  // Stollen carries four <strong> section labels but no fences at all --
  // an older page written before the BEGIN/END convention existed. Fall
  // back to the heading-driven parser rather than flattening it into one
  // undifferentiated section.
  if (fences.length === 0) return parseUnfencedBody(php)

  // Everything after the last fence (or the whole body, if there are
  // none) is trailing prose belonging to the final section.
  let cursor = 0
  fences.forEach((fence, index) => {
    const fenceStart = fence.index ?? 0
    const inner = fence[1]

    // Inside a fence, a paragraph is either the section's label or one
    // of its ingredient columns. Which class carries them is not fixed:
    // most recipes use text12 for the columns and text14+<strong> for
    // the label, but Anson's Beef uses text14 for both and marks its
    // label with a trailing colon rather than bold. Classify by shape,
    // not by class name.
    let label: string | null = null
    const columns: { attrs: string; inner: string }[] = []
    for (const paragraph of paragraphsOf(inner, BODY_CLASSES)) {
      const split = splitLabel(paragraph.inner)
      const text = htmlToMarkdown(split.rest)
      if (split.label !== null && text === '') {
        label ??= split.label
        continue
      }
      if (label === null && text.length > 0 && text.length < 80 && text.endsWith(':')) {
        label = text.replace(/\s*:\s*$/, '')
        continue
      }
      // No heuristic needed here: the BEGIN/END INGREDIENTS fence is
      // itself the semantic marker, so anything inside it that is not
      // the label is an ingredient column. Sauerkraut's list is two
      // lines (cabbage, salt) and isn't centred -- a shape-based guess
      // would drop it, and did.
      if (splitBrLines(split.rest).length > 0) {
        columns.push({ attrs: paragraph.attrs, inner: split.rest })
      }
    }

    // Prose between the previous fence and this one belongs to the
    // previous section, not this one.
    if (index > 0) {
      appendSteps(sections[sections.length - 1], body.slice(cursor, fenceStart))
    } else if (fenceStart > 0) {
      // Prose before the first fence is the summary/lead, already
      // captured by readPageSummary -- deliberately not duplicated here.
    }

    sections.push({
      label,
      sortOrder: sections.length + 1,
      ingredients: ingredientsFromColumns(
        columns.map((c) => c.inner),
        null,
        1,
      ),
      steps: [],
    })
    cursor = (fence.index ?? 0) + fence[0].length
  })

  if (sections.length === 0) {
    sections.push({ label: null, sortOrder: 1, ingredients: [], steps: [] })
    cursor = 0
  }
  appendSteps(sections[sections.length - 1], body.slice(cursor))
  return sections
}

// A paragraph may open with a bold lead-in that is really a section
// label -- `<strong>For the dough:</strong><br>` followed by content, or
// a <strong> on its own with nothing after it. Splitting the two apart
// is what lets Anson's Beef (which uses text14 for its entire body) and
// Sauerbraten (label and prose in one paragraph) parse at all.
function splitLabel(inner: string): { label: string | null; rest: string } {
  const match = inner.match(/^\s*<strong>([\s\S]*?)<\/strong>\s*(?:<br\s*\/?>)?/i)
  if (!match) return { label: null, rest: inner }
  const label = htmlToMarkdown(match[1]).replace(/\s*:\s*$/, '')
  return { label: label || null, rest: inner.slice(match[0].length) }
}

// text14 is included deliberately: it is the label class inside an
// ingredient fence, but outside one it is ordinary body copy. Anson's
// Beef uses it for every paragraph on the page and has no text12 at all,
// which is why it parsed as an empty recipe before this.
const BODY_CLASSES = 'text18|text16|text14|text12|text11|text10'

function appendSteps(section: ParsedSection, html: string, lang: Lang = null): void {
  for (const { attrs, inner } of paragraphsOf(html, BODY_CLASSES)) {
    const { rest } = splitLabel(inner)
    // A centered <p> inside the prose region is a stray ingredient list
    // (Eierschwer's modern version does this) -- keep it as ingredients
    // rather than mashing the lines into one paragraph.
    if (looksLikeIngredientList(rest, attrs)) {
      const start = section.ingredients.length + 1
      section.ingredients.push(...ingredientsFromColumns([rest], lang, start))
      continue
    }
    const body = htmlToMarkdown(rest)
    if (!body) continue
    section.steps.push({ body, lang, sortOrder: section.steps.length + 1 })
  }
}

// ---------------------------------------------------------------------
// Body: the Text/ dialect (unfenced, text18 headings)
// ---------------------------------------------------------------------

function parseUnfencedBody(php: string): ParsedSection[] {
  const body = bodyOf(php)
  const sections: ParsedSection[] = []
  let current: ParsedSection = { label: null, sortOrder: 1, ingredients: [], steps: [] }

  const startSection = (label: string | null): void => {
    if (current.ingredients.length > 0 || current.steps.length > 0) sections.push(current)
    current = { label, sortOrder: sections.length + 1, ingredients: [], steps: [] }
  }

  for (const { cls, attrs, inner } of paragraphsOf(body, BODY_CLASSES)) {
    const { label, rest } = splitLabel(inner)
    const restText = htmlToMarkdown(rest)

    // Three things start a new section, all of them real in the source:
    //   text18/text16          -- Molly's Fruitcake's batch scales
    //   a <strong>-only line   -- Stollen's "For the dough:" etc.
    //   a short text12 ending in a colon, with nothing else in it --
    //     Molly's second and third scales are announced this way
    //     ("To triple the recipe (ca. 13 small loaves):"), because only
    //     the first one got a real heading.
    const isHeadingClass = cls === 'text18' || cls === 'text16'
    const isBareLabel = label !== null && restText === ''
    const isColonLead =
      restText.length > 0 && restText.length < 80 && restText.endsWith(':')

    if (isHeadingClass || isBareLabel || isColonLead) {
      startSection(label ?? (htmlToMarkdown(inner).replace(/\s*:\s*$/, '') || null))
      continue
    }
    if (looksLikeIngredientList(rest, attrs)) {
      const start = current.ingredients.length + 1
      current.ingredients.push(...ingredientsFromColumns([rest], null, start))
      continue
    }
    if (restText) {
      current.steps.push({
        body: restText,
        lang: null,
        sortOrder: current.steps.length + 1,
      })
    }
  }
  if (current.ingredients.length > 0 || current.steps.length > 0) sections.push(current)
  if (sections.length === 0) {
    sections.push({ label: null, sortOrder: 1, ingredients: [], steps: [] })
  }
  return sections.map((section, index) => ({ ...section, sortOrder: index + 1 }))
}

// ---------------------------------------------------------------------
// Body: bilingual
// ---------------------------------------------------------------------

// The two FrauErica*.php files mark each paired paragraph with literal
// `<!-- German -->` / `<!-- English -->` comments inside a <tr>; that
// pairing is exactly the paragraph-by-paragraph layout the Archivist
// asked for, so it is preserved rather than reinvented. Sauerbraten is
// the older form of the same idea and has no comments -- there the side
// is carried by `margin-right` (German) vs `margin-left` (English).
function parseBilingualBody(php: string): ParsedSection[] {
  const body = bodyOf(php)
  const section: ParsedSection = { label: null, sortOrder: 1, ingredients: [], steps: [] }

  // Row by row, not chunk by chunk. A bilingual row holds two <td>
  // cells, German then English; a MONOLINGUAL row holds a single cell
  // spanning both columns -- which is how Eierschwer carries its modern
  // adaptation after the 1903 original.
  //
  // An earlier version took everything after the last </tr> as the
  // trailing monolingual section, which duplicated Sauerbraten's whole
  // recipe: once correctly paired, and again as untagged prose.
  const trailing: ParsedSection = {
    label: null,
    sortOrder: 2,
    ingredients: [],
    steps: [],
  }
  let pairOrder = 0

  for (const row of body.split(/<tr\b[^>]*>/i).slice(1)) {
    const cells = row
      .split(/<td\b[^>]*>/i)
      .slice(1)
      .map((cell) => cell.split(/<\/tr>/i)[0])

    if (cells.length >= 2) {
      pairOrder += 1
      appendPaired(section, cells[0], 'de', pairOrder)
      appendPaired(section, cells[1], 'en', pairOrder)
    } else if (cells.length === 1) {
      appendSteps(trailing, cells[0])
    }
  }

  const sections = [section]
  if (trailing.ingredients.length > 0 || trailing.steps.length > 0)
    sections.push(trailing)
  return sections
}

// One cell of a bilingual row. Several paragraphs can share a cell --
// the recipe itself plus a translator's footnote -- and they all stay
// inside the same pair so the two languages still line up row for row.
function appendPaired(
  section: ParsedSection,
  html: string,
  lang: Lang,
  pairOrder: number,
): void {
  let within = 0
  for (const { attrs, inner } of paragraphsOf(html, BODY_CLASSES)) {
    const { rest } = splitLabel(inner)
    if (looksLikeIngredientList(rest, attrs)) {
      for (const text of splitBrLines(rest)) {
        section.ingredients.push({
          text,
          columnNo: 1,
          lang,
          sortOrder: section.ingredients.filter((i) => i.lang === lang).length + 1,
        })
      }
      continue
    }
    const text = htmlToMarkdown(rest)
    if (!text) continue
    section.steps.push({ body: text, lang, sortOrder: pairOrder * 10 + within })
    within += 1
  }
}

// ---------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------

export interface ParseOptions {
  // The matching row from _arrayKeepers.php, when there is one. Its
  // summary wins over the page's: the two disagree for 25 of 50
  // recipes, and the index copy is the more recently edited one (it
  // fixes typos the page still carries).
  indexEntry?: IndexEntry
  // Text/ pages use a different dialect; see the module header.
  dialect?: 'keepers' | 'text'
  titleOverride?: string
  genreOverride?: string
  headerImageOverride?: string
  isPublished?: boolean
}

export function parseRecipe(php: string, options: ParseOptions = {}): ParsedRecipe {
  const warnings: string[] = []
  const bilingual = isBilingual(php)
  const dialect = options.dialect ?? 'keepers'

  const pageTitle = readPageTitle(php)
  const title = options.titleOverride ?? options.indexEntry?.title ?? pageTitle ?? ''
  if (!title) warnings.push('no title found in the page or the index')

  const pageSummary = readPageSummary(php)
  const summary = options.indexEntry?.summary ?? pageSummary
  if (options.indexEntry && pageSummary && options.indexEntry.summary !== pageSummary) {
    warnings.push('index summary differs from the page summary; using the index copy')
  }

  const sections = bilingual
    ? parseBilingualBody(php)
    : dialect === 'text'
      ? parseUnfencedBody(php)
      : parseFencedBody(php)

  const ingredientCount = sections.reduce((n, s) => n + s.ingredients.length, 0)
  const stepCount = sections.reduce((n, s) => n + s.steps.length, 0)
  if (ingredientCount === 0) warnings.push('no ingredients parsed')
  if (stepCount === 0) warnings.push('no steps parsed')

  const headerImage = options.headerImageOverride ?? readHeaderImage(php)
  if (!headerImage)
    warnings.push('no header image declared; will take the archive default')

  const genre = options.genreOverride ?? options.indexEntry?.genre ?? null
  if (!genre) warnings.push('no genre; recipe was not in the index')

  return {
    slug: slugify(title),
    title,
    genre,
    summary,
    headerImage,
    sourceNote: readSourceNote(`${summary ?? ''} ${php}`),
    isPublished: options.isPublished ?? Boolean(options.indexEntry),
    bilingual,
    sections,
    warnings,
  }
}
