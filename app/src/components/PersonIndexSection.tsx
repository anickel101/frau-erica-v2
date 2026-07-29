import { Person } from '../types/person'
import PersonIndexEntry from './PersonIndexEntry'

export default function PersonIndexSection({
  letter,
  persons,
}: {
  letter: string
  persons: Person[]
}) {
  return (
    <section className="mt-8">
      <h2 className="text-fe-brown font-bold text-xl">{letter}</h2>
      <hr className="border-fe-brown mb-4" />
      {/* CSS multi-column, not a grid -- a grid's default row-first auto-flow
          alphabetizes left-to-right across columns (A, B under one heading,
          C, D under the next), which is awkward to scan down. Multi-column
          fills the first column top-to-bottom before starting the next,
          matching a phone-book/dictionary reading order instead. */}
      <div className="columns-1 sm:columns-3 gap-x-8">
        {persons.map((person) => (
          <PersonIndexEntry key={person.person_id} person={person} />
        ))}
      </div>
    </section>
  )
}
