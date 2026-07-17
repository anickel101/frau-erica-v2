import { useMemo, useState } from 'react'
import Layout from '../components/Layout'
import PersonIndexSection from '../components/PersonIndexSection'
import SearchInput from '../components/SearchInput'
import { mockPersons } from '../data/mockPersons'
import { groupByLetter } from '../utils/groupByLetter'
import { getFullName, getGroupLetter } from '../utils/personDisplay'

export default function PersonsPage() {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? mockPersons.filter((p) => getFullName(p).toLowerCase().includes(q))
      : mockPersons
    return groupByLetter(filtered, getGroupLetter)
  }, [query])

  return (
    <Layout>
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Index of persons</h1>
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name..." />
        {groups.map(([letter, persons]) => (
          <PersonIndexSection key={letter} letter={letter} persons={persons} />
        ))}
      </div>
    </Layout>
  )
}
