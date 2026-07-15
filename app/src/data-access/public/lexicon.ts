import lexiconRaw from '../../data/generated/lexicon.json'

export interface LexiconEntry {
  term: string
  pronunciation: string | null
  part_of_speech: string
  definition: string
}

const lexicon: LexiconEntry[] = (lexiconRaw as LexiconEntry[])
  .slice()
  .sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()))

export function listLexiconEntries(): LexiconEntry[] {
  return lexicon
}
