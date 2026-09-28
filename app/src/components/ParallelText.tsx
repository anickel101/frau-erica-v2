import { Fragment } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'

// A work the archive holds in both German and English, set side by side
// with each paragraph against its own translation.
//
// HOW THE ALIGNMENT WORKS, and why there is no measuring code here: the
// two halves are one CSS grid, two columns wide, with the blocks fed in
// interleaved -- German 1, English 1, German 2, English 2. A grid row is
// as tall as its tallest cell and every cell in it starts at the same
// top edge, so paragraph n and its translation begin on the same line
// however long either one runs. Nothing is measured, and nothing needs
// to be recomputed when the window changes.
//
// The same interleaving is what makes the narrow layout work. Collapse
// the grid to one column and the source order takes over: German 1,
// English 1, German 2, English 2, reading straight down -- which is
// exactly how these documents read before they were ever split, so a
// phone reader loses nothing and gains no unfamiliar layout.
//
// Block counts are guaranteed equal by the export (see
// scripts/parallelTextValidation.ts, which refuses to export a pair that
// has drifted). The defensive zip below is for the case that guarantee
// is ever bypassed -- a stale documents.json, say -- where showing one
// half short is far better than dropping paragraphs silently.

// Markdown blocks are separated by blank lines. Safe for these documents
// specifically: none of the archive's parallel texts contain lists,
// block quotes or fenced code, where a blank line can fall INSIDE a
// single markdown block.
function toBlocks(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

export default function ParallelText({
  german,
  english,
  components,
}: {
  german: string
  english: string
  components: Partial<Components>
}) {
  const germanBlocks = toBlocks(german)
  const englishBlocks = toBlocks(english)
  const rowCount = Math.max(germanBlocks.length, englishBlocks.length)

  return (
    <div className="text-[12px] text-fe-ink">
      {/* One grid, not two columns of text: two independent columns
          would each flow at their own pace and the pairing would drift
          apart after the first paragraph whose translation runs long. */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {/* Column headings, on the wide layout only. Stacked on a
            phone they would sit above the German of every pair and
            read as clutter -- and there they are not needed, since
            the alternation is the same one these documents have
            always had. */}
        <p className="hidden text-xs font-bold uppercase tracking-wide text-fe-brown sm:block">
          German
        </p>
        <p className="hidden text-xs font-bold uppercase tracking-wide text-fe-brown sm:block">
          English
        </p>

        {Array.from({ length: rowCount }, (_, row) => (
          // Two cells per row, German then English, so the grid pairs
          // them in two columns and stacks them in one.
          <Fragment key={row}>
            <Block content={germanBlocks[row]} components={components} lang="de" />
            <Block content={englishBlocks[row]} components={components} lang="en" />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// lang is set so a screen reader switches voice at the right paragraph,
// and so a browser hyphenates German by German rules -- which matters
// more than usual here, in a narrow column full of long compounds.
//
// [&>*:last-child]:mb-0 zeroes the trailing margin of whatever markdown
// block this happens to end on, so the gap between grid rows is gap-y-4
// and nothing else. Without it a paragraph's own mb-4 would stack on top
// of the row gap, and only in the cells that end in a paragraph -- so
// pairs would sit at different distances down the page depending on what
// each one ended with.
function Block({
  content,
  components,
  lang,
}: {
  content: string | undefined
  components: Partial<Components>
  lang: 'de' | 'en'
}) {
  // An absent block means the two halves disagree about how many
  // paragraphs they have, which the export is supposed to prevent. Keep
  // the cell so the pairing after it stays aligned.
  if (!content) return <div aria-hidden="true" />

  return (
    <div lang={lang} className="flow-root [&>*:last-child]:mb-0">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}
