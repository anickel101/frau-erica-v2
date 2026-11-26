// A text's paragraphs as the site pairs them in a bilingual text: split
// at blank lines. The nth German paragraph is set beside the nth English
// one, so this rule is the pairing -- the export refuses a pair whose
// counts differ (scripts/parallelTextValidation.ts, which uses the same
// split from scripts/parallelTextSplitter.ts), and the API applies it to
// a submitted edit (api/src/lib/textEditPlan.ts). Kept identical in all
// three; paragraphs.test.ts pins this one to the script's.
export function toBlocks(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}
