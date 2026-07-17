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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
        {persons.map((person) => (
          <PersonIndexEntry key={person.person_id} person={person} />
        ))}
      </div>
    </section>
  )
}
