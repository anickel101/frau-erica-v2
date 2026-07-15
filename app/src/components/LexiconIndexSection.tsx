import { LexiconEntry as LexiconEntryData } from '../data-access/public/lexicon'
import LexiconEntry from './LexiconEntry'

export default function LexiconIndexSection({
  letter,
  entries,
}: {
  letter: string
  entries: LexiconEntryData[]
}) {
  return (
    <section className="mt-8">
      <h2 className="text-fe-brown font-bold text-xl">{letter}</h2>
      <hr className="border-fe-brown mb-4" />
      {entries.map((entry) => (
        <LexiconEntry key={entry.term} entry={entry} />
      ))}
    </section>
  )
}
