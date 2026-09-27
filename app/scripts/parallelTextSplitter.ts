// Splits one interleaved German/English document into its two halves.
//
// Several works in the archive are held as a single document with the
// German and its English translation alternating -- see schema.sql's
// note under Documents. Splitting them is what lets the site set the
// two languages side by side.
//
// The shape of the problem, from reading the real documents:
//
//   German heading          <- a "section pair": some number of German
//   German paragraph 1         blocks, then exactly as many English
//   German paragraph 2         ones, being their translations in order
//   English heading
//   English paragraph 1
//   English paragraph 2
//
// Section length varies wildly -- 1 block (Fritz's journal alternates
// paragraph by paragraph in places) up to 11 (document 91 is one long
// German half followed by one long English half). Ludwig Knief's memoir
// is strictly 1:1 throughout. So the run lengths cannot be assumed; they
// have to be found.
//
// WHY THIS IS NOT JUST "CLASSIFY EACH BLOCK AND GROUP THE RUNS":
// that was the first attempt, and it split 8 of 17 documents correctly.
// It fails on exactly the blocks where a word-frequency classifier has
// nothing to go on -- "**21. August**", "*(Fortsetzung folgt.)*", a
// couplet with no umlauts in it. Those are short, and short blocks are
// where per-block classification is weakest.
//
// The fix is to stop classifying blocks independently and use the
// structure itself. A German block and its English translation are a
// PAIR, and pairs leave evidence a classifier doesn't see in either
// block alone: they are close in length, they share proper nouns and
// numbers ("21"/"August" survive translation), and a heading is
// translated as a heading. So this searches for the segmentation that
// best explains the whole document at once -- every block's own
// language signal PLUS how well it pairs with the block it would be
// matched to -- rather than deciding block by block and hoping the runs
// line up.
//
// Nothing here touches the database or the filesystem: it takes text
// and returns a proposal with its own confidence, for a human to read
// before anything is written. See splitParallelText.ts for the CLI.

export type Language = 'de' | 'en'

export interface BlockReport {
  // Position in the original document, so a reviewer can find it.
  index: number
  language: Language
  text: string
  // How strongly the block's OWN words say it is that language, 0..1.
  // A long paragraph scores near 1. A bare date heading scores ~0 --
  // not a bug, just the honest statement that "**21. August**" is three
  // characters of evidence.
  ownConfidence: number
  // Whether the pairing (length, shared names and numbers, heading
  // shape) agrees with where it ended up. This is what decides the
  // blocks ownConfidence can't.
  pairConfidence: number
}

export interface SectionPair {
  german: BlockReport[]
  english: BlockReport[]
}

export interface SplitProposal {
  pairs: SectionPair[]
  germanContent: string
  englishContent: string
  // Blocks a reviewer should actually look at: those the classifier was
  // unsure of AND the pairing didn't rescue.
  uncertain: BlockReport[]
  // Problems: reasons not to apply this proposal as it stands.
  warnings: string[]
  // Things the splitter did that a reviewer should know about but that
  // are not problems -- dropping a hand-written navigation link, say.
  notes: string[]
  // True when the document split into complete, equal-length section
  // pairs with no blocks left over. False means the proposal is a best
  // effort and should not be applied without reading it.
  clean: boolean
}

// Function words, the workhorse of cheap language identification: they
// are frequent, short, and almost never shared between the two
// languages. Deliberately not a dependency -- the whole classifier is
// ~40 lines, and a language-detection library would still fail on
// "**21. August**", which is the actual hard part.
const GERMAN_WORDS = new Set(
  `der die das und ich nicht ist ein eine den dem des mit auf sich von zu
   wir sie er es als auch war wurde noch nur bei aus dann sehr haben hat
   wie am im daß dass für nach schon wenn aber oder über unter durch
   uns mir mich ihm ihr sein seine unser diese dieser dieses mehr so
   wieder hier da doch man alle als um vor zur zum einen einem einer`
    .split(/\s+/)
    .filter(Boolean),
)

const ENGLISH_WORDS = new Set(
  `the and of was to a in that he she it we they for on with his her had
   have this but not are were from at by as be been is our their them
   him me my you your there which when where what would could should all
   one more very about into than then`
    .split(/\s+/)
    .filter(Boolean),
)

// ä ö ü ß never appear in English. Weighted heavily because one umlaut
// is worth more evidence than several ambiguous function words.
const UMLAUT = /[äöüÄÖÜß]/g

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-zäöüß]+/g) ?? []
}

// Signed evidence for one block: positive means German, negative means
// English, and the magnitude is roughly "how many pieces of evidence".
function languageEvidence(text: string): number {
  const ws = words(text)
  let score = 0
  for (const w of ws) {
    if (GERMAN_WORDS.has(w)) score += 1
    if (ENGLISH_WORDS.has(w)) score -= 1
  }
  score += 3 * (text.match(UMLAUT)?.length ?? 0)
  return score
}

// Squashed to 0..1 so it can be compared across blocks of any length. 4
// pieces of evidence is already decisive; the exact curve matters less
// than that a bare heading lands near 0 and a paragraph near 1.
function confidenceFrom(evidence: number): number {
  return 1 - Math.exp(-Math.abs(evidence) / 4)
}

function isHeading(text: string): boolean {
  return /^(#{1,6}\s|\*\*)/.test(text.trim())
}

// Tokens that survive translation: numbers, and capitalised words that
// aren't simply the first word of a sentence. Names, places and dates
// are the same on both sides of a pair -- "Niagara", "1865", "August".
function durableTokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const n of text.match(/\d+/g) ?? []) out.add(n)
  for (const w of text.match(/[A-ZÄÖÜ][a-zäöüß]{2,}/g) ?? []) out.add(w.toLowerCase())
  return out
}

// How much two blocks look like a translation pair, 0..1.
//
// This is the signal that decides the blocks their own words can't.
// "**21. August**" and "**August 21**" share the token "21" and are
// near-identical in length, which is plenty; "(Fortsetzung folgt.)" and
// "(To be continued)" share nothing but are both 20 characters and both
// short, which is weaker but still points the right way.
function pairAffinity(german: string, english: string): number {
  const lengthRatio =
    Math.min(german.length, english.length) / Math.max(german.length, english.length, 1)

  const gt = durableTokens(german)
  const et = durableTokens(english)
  let shared = 0
  for (const t of gt) if (et.has(t)) shared += 1
  const possible = Math.min(gt.size, et.size)
  const tokenScore = possible === 0 ? 0 : shared / possible

  // A heading is translated as a heading. Disagreement here is a strong
  // signal the pairing is wrong, so it is penalised rather than merely
  // not rewarded.
  const headingAgreement = isHeading(german) === isHeading(english) ? 1 : -1

  return 0.5 * lengthRatio + 0.3 * tokenScore + 0.2 * headingAgreement
}

// Score for pairing blocks [start, start+size) as German against
// [start+size, start+2*size) as English, in order.
function sectionScore(blocks: string[], start: number, size: number): number {
  let score = 0
  for (let t = 0; t < size; t += 1) {
    const german = blocks[start + t]
    const english = blocks[start + size + t]
    // Each block's own evidence, signed so that a German block scoring
    // German is rewarded and a German block that reads as English is
    // penalised by the same amount.
    score +=
      confidenceFrom(languageEvidence(german)) * Math.sign(languageEvidence(german))
    score -=
      confidenceFrom(languageEvidence(english)) * Math.sign(languageEvidence(english))
    score += pairAffinity(german, english)
  }
  return score
}

// Finds the best way to cut the document into complete section pairs.
//
// best[i] is the score of the best partition of blocks [0, i) into whole
// pairs; i is always even, since every section pair uses 2*size blocks.
// Each step tries every section size that fits and keeps the best,
// which is O(n^2) sections x O(n) to score one -- trivial at the ~50
// blocks these documents actually have, and it considers segmentations
// no left-to-right greedy pass ever would.
function bestSegmentation(blocks: string[]): { cuts: number[]; score: number } | null {
  const n = blocks.length
  if (n === 0 || n % 2 === 1) return null

  const best = new Array<number>(n + 1).fill(Number.NEGATIVE_INFINITY)
  const from = new Array<number>(n + 1).fill(-1)
  best[0] = 0

  for (let i = 2; i <= n; i += 2) {
    for (let size = 1; size * 2 <= i; size += 1) {
      const start = i - size * 2
      if (best[start] === Number.NEGATIVE_INFINITY) continue
      const score = best[start] + sectionScore(blocks, start, size)
      if (score > best[i]) {
        best[i] = score
        from[i] = start
      }
    }
  }

  if (best[n] === Number.NEGATIVE_INFINITY) return null

  const cuts: number[] = []
  for (let i = n; i > 0; i = from[i]) cuts.push(from[i])
  return { cuts: cuts.reverse(), score: best[n] }
}

// When a document has an odd number of blocks it cannot pair up, and
// "something is wrong somewhere" is not much help to whoever has to fix
// it. This finds WHERE: drop each block in turn, split what is left,
// and report the one whose removal explains the rest of the document
// best. That block is either a paragraph translated on one side and not
// the other, or -- as in document 139 -- two paragraphs the archive has
// welded into one.
function findOddBlockOut(blocks: string[]): number | null {
  let bestIndex: number | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (let i = 0; i < blocks.length; i += 1) {
    const without = [...blocks.slice(0, i), ...blocks.slice(i + 1)]
    const result = bestSegmentation(without)
    if (result && result.score > bestScore) {
      bestScore = result.score
      bestIndex = i
    }
  }
  return bestIndex
}

// A markdown table in one of these documents is very likely a
// conversion artifact from the original site rather than a real table:
// document 139 has a one-column table, opened without a preceding blank
// line, that swallowed a German passage into the end of an English
// paragraph. Worth saying out loud, because blank-line block splitting
// cannot separate what the source welded together.
const TABLE_ROW = /^\s*\|.*\|\s*$/m

// Splits markdown into blocks on blank lines.
//
// Safe for these documents specifically: none of the parallel texts
// contain lists, blockquotes or fenced code, where a blank line can sit
// INSIDE one markdown block and this would cut it in half. Verified
// across all 17 candidates; document 139's table is the one construct
// that needs a look before that document is split.
export function toBlocks(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
}

// Hand-written "next chapter" links, which the archive carries in four
// different shapes depending on when the document was written:
//
//   **Next:** [On the High Seas](/documents/88)     26 documents
//   [Next: II. Childhood](/documents/135)            8 documents
//   Next: [something](/documents/N)                  4 documents
//   **Next:** [Postscript](/documents/93)            1 document
//
// These are navigation, not text, and they are English-only -- which
// makes them an unpaired block that would otherwise leave a document
// with an odd block count and no valid split. The site derives this
// navigation from series_order instead, so they come out here.
//
// Two conditions keep this from eating real content. It must be the
// LAST block, and the whole block must be consumed by the pattern --
// documents 128 and 129 each end with a sentence built around a
// /documents/ link ("[...](/documents/N) the obituary from the National
// Park Service."), which is prose and stays.
const TRAILING_NAVIGATION =
  /^(?:\*\*)?(?:next|previous|postscript|continued)?\s*:?\s*(?:\*\*)?\s*\[[^\]]+\]\(\/documents\/\d+\)\.?$/i

export function stripTrailingNavigation(blocks: string[]): {
  blocks: string[]
  removed: string | null
} {
  if (blocks.length === 0) return { blocks, removed: null }
  const last = blocks[blocks.length - 1]
  if (!TRAILING_NAVIGATION.test(last)) return { blocks, removed: null }
  return { blocks: blocks.slice(0, -1), removed: last }
}

export function splitParallelText(content: string): SplitProposal {
  const { blocks, removed } = stripTrailingNavigation(toBlocks(content))
  const warnings: string[] = []
  const notes: string[] = []
  if (removed) {
    notes.push(
      `Dropped a hand-written navigation link, which the site now derives ` +
        `from the series instead: ${removed}`,
    )
  }

  if (blocks.length === 0) {
    return {
      pairs: [],
      germanContent: '',
      englishContent: '',
      uncertain: [],
      warnings: ['Document has no content.'],
      notes,
      clean: false,
    }
  }

  if (blocks.length % 2 === 1) {
    warnings.push(
      `${blocks.length} blocks is an odd number, so they cannot pair up. ` +
        'One language has a paragraph the other does not -- find it before splitting.',
    )
  }

  for (const [i, block] of blocks.entries()) {
    if (TABLE_ROW.test(block)) {
      warnings.push(
        `Block ${i} contains markdown table syntax. In this archive that is ` +
          `usually a conversion artifact that has welded two paragraphs ` +
          `together -- check it by hand before splitting.`,
      )
    }
  }

  const segmentation = bestSegmentation(blocks)
  if (!segmentation) {
    if (blocks.length % 2 === 1) {
      const odd = findOddBlockOut(blocks)
      if (odd !== null) {
        warnings.push(
          `The rest of the document pairs up cleanly if block ${odd} is set ` +
            `aside, so that block is the most likely place to look: ` +
            `${JSON.stringify(blocks[odd].slice(0, 80))}`,
        )
      }
    }
    return {
      pairs: [],
      germanContent: '',
      englishContent: '',
      uncertain: [],
      warnings: [...warnings, 'No valid split into section pairs was found.'],
      notes,
      clean: false,
    }
  }

  const pairs: SectionPair[] = []
  const uncertain: BlockReport[] = []

  const { cuts } = segmentation
  for (let c = 0; c < cuts.length; c += 1) {
    const start = cuts[c]
    const end = c + 1 < cuts.length ? cuts[c + 1] : blocks.length
    const size = (end - start) / 2

    const german: BlockReport[] = []
    const english: BlockReport[] = []

    for (let t = 0; t < size; t += 1) {
      const gi = start + t
      const ei = start + size + t
      const affinity = Math.max(0, Math.min(1, pairAffinity(blocks[gi], blocks[ei])))

      const gEvidence = languageEvidence(blocks[gi])
      const eEvidence = languageEvidence(blocks[ei])

      // Own confidence counts only when the block agrees with the side
      // it landed on. A block placed in the German half whose words read
      // as English is not "confident" -- it is a problem, and scores 0
      // so it surfaces in the uncertain list.
      const gReport: BlockReport = {
        index: gi,
        language: 'de',
        text: blocks[gi],
        ownConfidence: gEvidence > 0 ? confidenceFrom(gEvidence) : 0,
        pairConfidence: affinity,
      }
      const eReport: BlockReport = {
        index: ei,
        language: 'en',
        text: blocks[ei],
        ownConfidence: eEvidence < 0 ? confidenceFrom(eEvidence) : 0,
        pairConfidence: affinity,
      }

      german.push(gReport)
      english.push(eReport)

      // Worth a human's time only when BOTH signals are weak: a bare
      // date heading with no language evidence is fine if it pairs
      // cleanly with its counterpart, and flagging it would bury the
      // real problems in noise.
      for (const report of [gReport, eReport]) {
        if (report.ownConfidence < 0.5 && report.pairConfidence < 0.6) {
          uncertain.push(report)
        }
      }
    }

    pairs.push({ german, english })
  }

  const germanContent = pairs.flatMap((p) => p.german.map((b) => b.text)).join('\n\n')
  const englishContent = pairs.flatMap((p) => p.english.map((b) => b.text)).join('\n\n')

  return {
    pairs,
    germanContent,
    englishContent,
    uncertain,
    warnings,
    notes,
    clean: warnings.length === 0 && uncertain.length === 0,
  }
}
