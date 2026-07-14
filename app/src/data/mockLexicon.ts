import raw from './mockLexicon.json'

export interface LexiconEntry {
  term: string
  pronunciation: string
  part_of_speech: string
  definition: string
}

export const mockLexicon: LexiconEntry[] = (raw as LexiconEntry[])
  .slice()
  .sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()))
