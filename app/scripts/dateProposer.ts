// Proposes a date for a document, from what the document already says.
//
// The archive has no date column. Adding one means answering "when is
// this text from?" 153 times, and the point of this module is to make
// that a question of CONFIRMING rather than TRANSCRIBING: 113 of the 153
// published documents already carry a year somewhere in their own text.
//
// THE DISTINCTION THAT MATTERS, and the reason every proposal carries
// its source: a year in a TITLE is almost always the document's own date
// -- "Chicago 1967", "Christmas 1995". A year in a SUMMARY usually
// belongs to the subject, not the text: a biography whose summary says
// "born in 1844" is not a document from 1844. Treating those two as the
// same signal would fill the archive with confidently wrong dates, which
// is worse than leaving the column empty, because nobody re-checks a
// field that looks answered.
//
// So nothing here is authoritative. Every proposal reports where it came
// from and how much to trust it, and the low-confidence ones are
// expected to be corrected by hand.

export type Confidence = 'high' | 'medium' | 'low'

export interface DateProposal {
  // What a reader should see, in the form the archive would write it:
  // "November 8, 1933", "December 1995", "1867".
  display: string
  // Sortable, loosest-precision-last: "1933-11-08", "1995-12", "1867".
  // Lexicographic order on these is chronological order, which is what
  // a timeline and an "oldest first" sort both need.
  sort: string
  confidence: Confidence
  // Which field it came from and what matched, so a reviewer can judge
  // the proposal without opening the document.
  source: string
}

export interface ProposalResult {
  proposal: DateProposal | null
  // Set when there IS date-like text but it should not become a date --
  // a lifespan in the title of a biography, say. Worth showing a
  // reviewer: it means "looked, found something, deliberately declined".
  declined?: string
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
  // German, for Fritz Mueller's journal and Ludwig Knief's memoir, whose
  // datelines are in the original: "Auf der Rhede von Bremerhafen, den
  // 19. August 1865."
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  mai: 5,
  juni: 6,
  juli: 7,
  oktober: 10,
  dezember: 12,
}

const MONTH_NAMES = Object.keys(MONTHS).join('|')

// "November 8, 1933" / "8 November 1933" / "den 19. August 1865"
const FULL_DATE = new RegExp(
  `\\b(?:(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(1[6-9]\\d{2}|20[0-2]\\d)` +
    `|(\\d{1,2})\\.?\\s+(${MONTH_NAMES})\\.?,?\\s+(1[6-9]\\d{2}|20[0-2]\\d))\\b`,
  'i',
)

// "December 1995", "Dezember 1865" -- month and year, no day.
const MONTH_YEAR = new RegExp(
  `\\b(${MONTH_NAMES})\\.?,?\\s+(1[6-9]\\d{2}|20[0-2]\\d)\\b`,
  'i',
)

const YEAR = /\b(1[6-9]\d{2}|20[0-2]\d)\b/

// TWO years in a title means a span, not a date -- a lifespan
// ("Shirley Jean King (1947-2022)"), a tenure ("Our Redeemer Lutheran
// Church, 1967-1972"), a voyage. Either way the document covers a
// period rather than being FROM a moment, and picking one end would be
// a confident lie.
//
// Counting years rather than matching a dash-joined pair, because the
// pair is often two full dates with words between them: "Alice Ingram
// Hooker, November 8, 1933 - July 23, 2019" has no YYYY-YYYY in it at
// all. The dash-based version of this check missed exactly that case
// and proposed the birth date, at high confidence, as the date of the
// document -- the precise failure this module exists to avoid.
function yearsIn(text: string): string[] {
  return [...new Set(text.match(/\b(?:1[6-9]\d{2}|20[0-2]\d)\b/g) ?? [])]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function monthNumber(name: string): number | undefined {
  return MONTHS[name.toLowerCase()]
}

// A full date, a month-and-year, or a bare year -- whichever is present,
// at the best precision available.
function extract(text: string): { display: string; sort: string } | null {
  const full = FULL_DATE.exec(text)
  if (full) {
    const monthName = full[1] ?? full[5]
    const day = full[2] ?? full[4]
    const year = full[3] ?? full[6]
    const month = monthNumber(monthName)
    if (month && day && year) {
      // Display in the archive's own house style (American, month
      // first), regardless of which order it was written in -- the
      // German journals write "19. August 1865".
      const monthLabel = Object.keys(MONTHS).find(
        (k) => MONTHS[k] === month && k.length > 3,
      )
      const label = monthLabel
        ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
        : monthName
      return {
        display: `${label} ${Number(day)}, ${year}`,
        sort: `${year}-${pad(month)}-${pad(Number(day))}`,
      }
    }
  }

  const monthYear = MONTH_YEAR.exec(text)
  if (monthYear) {
    const month = monthNumber(monthYear[1])
    const year = monthYear[2]
    if (month) {
      const label = monthYear[1].charAt(0).toUpperCase() + monthYear[1].slice(1)
      return { display: `${label} ${year}`, sort: `${year}-${pad(month)}` }
    }
  }

  const year = YEAR.exec(text)
  if (year) return { display: year[1], sort: year[1] }

  return null
}

export interface DocumentForDating {
  document_id: number
  title: string
  series_title: string | null
  summary: string | null
  content: string | null
}

export function proposeDate(document: DocumentForDating): ProposalResult {
  const title = document.title ?? ''

  // Checked before anything else, because the title would otherwise
  // yield a confident, wrong answer.
  const titleYears = yearsIn(title)
  if (titleYears.length > 1) {
    return {
      proposal: null,
      declined: `title spans ${titleYears.join('-')}, so it covers a period rather than naming a date`,
    }
  }

  const fromTitle = extract(title)
  if (fromTitle) {
    return {
      proposal: {
        ...fromTitle,
        confidence: 'high',
        source: `title: "${title.trim().slice(0, 50)}"`,
      },
    }
  }

  const kicker = document.series_title ?? ''
  const fromKicker = extract(kicker)
  if (fromKicker) {
    return {
      proposal: {
        ...fromKicker,
        confidence: 'high',
        source: `kicker: "${kicker.trim().slice(0, 50)}"`,
      },
    }
  }

  // A dateline: a short opening block carrying a date, the way a letter
  // or a journal entry starts. Strong evidence -- much stronger than a
  // year buried in the body -- so it is looked for specifically rather
  // than lumped in with the rest of the content.
  const firstBlocks = (document.content ?? '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 3)
  for (const block of firstBlocks) {
    if (block.length > 120) continue
    const dateline = extract(block)
    if (dateline && (FULL_DATE.test(block) || MONTH_YEAR.test(block))) {
      return {
        proposal: {
          ...dateline,
          confidence: 'medium',
          source: `dateline: "${block.replace(/\s+/g, ' ').slice(0, 50)}"`,
        },
      }
    }
  }

  // Everything below is a year MENTIONED somewhere, which is a much
  // weaker claim about when the text is from -- see the note at the top.
  const summary = document.summary ?? ''
  const fromSummary = extract(summary)
  if (fromSummary) {
    return {
      proposal: {
        ...fromSummary,
        confidence: 'low',
        source: `mentioned in summary -- may be the subject's date, not the text's`,
      },
    }
  }

  const head = (document.content ?? '').slice(0, 600)
  const fromHead = extract(head)
  if (fromHead) {
    return {
      proposal: {
        ...fromHead,
        confidence: 'low',
        source: `mentioned in opening text -- may be the subject's date, not the text's`,
      },
    }
  }

  return { proposal: null }
}
