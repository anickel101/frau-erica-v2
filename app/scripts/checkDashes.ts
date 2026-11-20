// Fails CI if a double hyphen standing in for a dash reaches the site:
// "never carry one -- so you cannot" should read "never carry one – so
// you cannot". The Archivist asked for the en dash, spaced, in 2026-11.
//
// Run after `vite build`, against what is actually shipped. The minified
// bundle has no comments left in it -- the source uses "--" in comments
// hundreds of times, harmlessly -- so anything found here is text a
// reader can see: page copy, an error message, or archive text exported
// into src/data/generated/ (a gallery summary, a collection blurb). One
// check covers both the code and the archive.
//
// Not matched: "---", the Markdown rule above a text's footnotes, and
// operators like `i--`, which the minifier never writes with a space on
// both sides.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const DIST = path.join(import.meta.dirname, '..', 'dist')
const PATTERN = / -- /g

const files = [
  'index.html',
  ...readdirSync(path.join(DIST, 'assets'))
    .filter((name) => name.endsWith('.js') || name.endsWith('.html'))
    .map((name) => path.join('assets', name)),
]

let found = 0
for (const file of files) {
  const text = readFileSync(path.join(DIST, file), 'utf8')
  for (const match of text.matchAll(PATTERN)) {
    const start = Math.max(0, match.index - 60)
    const context = text.slice(start, match.index + 60).replace(/\s+/g, ' ')
    console.error(`${file}: …${context}…`)
    found++
  }
}

if (found > 0) {
  console.error(
    `\n${found} double hyphen(s) in visible text. Use a spaced en dash ( – ) instead.` +
      '\nIn page copy, fix the source; in archive text, fix the database and re-export.',
  )
  process.exit(1)
}
console.log('check-dashes: no double hyphens in the built site')
