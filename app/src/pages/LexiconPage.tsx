import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import Layout from '../components/Layout'
import LexiconIndexSection from '../components/LexiconIndexSection'
import SearchInput from '../components/SearchInput'
import { LexiconEntry, mockLexicon } from '../data/mockLexicon'
import { groupByLetter } from '../utils/groupByLetter'
import { useHeaderRef } from '../hooks/useHeaderRef'

// See FamilyHeader in FamilyPage.tsx for why this is its own component:
// useHeaderRef() must be called from within Layout's children.
function LexiconHeader() {
  const headerRef = useHeaderRef()
  return (
    <div
      ref={headerRef}
      className="max-w-4xl h-64 sm:h-80 bg-fe-brown/20 flex items-center justify-center"
    >
      <p className="text-fe-ink/40 text-sm">No header image</p>
    </div>
  )
}

const INTRO = `Certain German words and phrases persist in daily usage down through the generations. Some have been Anglicized, some have shifted a bit in meaning, and some had particular meaning within the Mueller family circle (e.g., *Büpfer*). Many are no longer to be found in German/English dictionaries or online translators. So here they are, some of them. Some of the terms may trace back to Fritz Mueller himself (d. 1866), which accounts for their absence in 20th and 21st-century lexicons.

If your branch of the Mueller family tree still uses a few German terms, drop the Archivist a line and let him know. He will happily add to the lexicon and credit the proper branch.

**Disclaimer:** Spellings, where possible, have been checked in *Cassell's German Dictionary,* but many spellings are necessarily guesswork. Apologies in advance for butchery; all errors will be promptly corrected.`

function getGroupLetter(entry: LexiconEntry): string {
  return entry.term[0].toUpperCase()
}

export default function LexiconPage() {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? mockLexicon.filter((e) => e.term.toLowerCase().includes(q))
      : mockLexicon
    return groupByLetter(filtered, getGroupLetter)
  }, [query])

  return (
    <Layout>
      <div className="p-6">
        <LexiconHeader />
        <div className="max-w-4xl mt-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">The Mueller Lexicon</h1>
          <div className="prose prose-sm max-w-none mb-6 space-y-4 text-fe-ink/90">
            <ReactMarkdown>{INTRO}</ReactMarkdown>
          </div>
          <hr className="border-fe-brown mb-4" />
          <SearchInput value={query} onChange={setQuery} placeholder="Search terms..." />
          {groups.map(([letter, entries]) => (
            <LexiconIndexSection key={letter} letter={letter} entries={entries} />
          ))}
        </div>
      </div>
    </Layout>
  )
}
