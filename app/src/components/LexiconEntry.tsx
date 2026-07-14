import { LexiconEntry as LexiconEntryData } from '../data/mockLexicon'
import InlineMarkdown from './InlineMarkdown'

export default function LexiconEntry({ entry }: { entry: LexiconEntryData }) {
  return (
    <div className="mb-4 text-sm">
      <p>
        <strong>{entry.term}</strong>
        {entry.pronunciation && (
          <>
            {' '}
            [<InlineMarkdown>{entry.pronunciation}</InlineMarkdown>]
          </>
        )}
      </p>
      <p>
        [<InlineMarkdown>{entry.part_of_speech}</InlineMarkdown>]{' '}
        <InlineMarkdown>{entry.definition}</InlineMarkdown>
      </p>
    </div>
  )
}
