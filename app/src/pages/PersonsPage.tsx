import { useMemo, useState } from 'react'
import Layout from '../components/Layout'
import PersonIndexSection from '../components/PersonIndexSection'
import SearchInput from '../components/SearchInput'
import { Person, mockPersons } from '../data/mockPersons'
import { getFullName, getGroupLetter } from '../utils/personDisplay'

function groupByLetter(persons: Person[]): [string, Person[]][] {
  const groups = new Map<string, Person[]>()
  for (const person of persons) {
    const letter = getGroupLetter(person)
    const group = groups.get(letter)
    if (group) group.push(person)
    else groups.set(letter, [person])
  }
  return [...groups.entries()]
}

export default function PersonsPage() {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? mockPersons.filter((p) => getFullName(p).toLowerCase().includes(q))
      : mockPersons
    return groupByLetter(filtered)
  }, [query])

  return (
    <Layout>
      <div className="px-4 sm:px-8 py-12 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Index of persons</h1>
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name..." />
        {groups.map(([letter, persons]) => (
          <PersonIndexSection key={letter} letter={letter} persons={persons} />
        ))}
      </div>
    </Layout>
  )
}
