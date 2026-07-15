import { Link } from 'react-router-dom'
import { PersonSummary, formatBirthDate } from '../data/mockFamily'

type Generation = 'grandparent' | 'couple' | 'child'

const GENERATION_STYLES: Record<Generation, string> = {
  grandparent: 'bg-fe-gen-grandparent',
  couple: 'bg-fe-gen-couple',
  child: 'bg-fe-gen-child',
}

// Direction arrows are meaningful, not decorative: up = an ancestor
// (click through to their own parents), down = a descendant.
const DIRECTION_ARROW: Record<Generation, '▲' | '▼' | null> = {
  grandparent: '▲',
  couple: null,
  child: '▼',
}

export default function PersonCard({
  person,
  generation,
}: {
  person: PersonSummary
  generation: Generation
}) {
  const arrow = DIRECTION_ARROW[generation]

  return (
    <Link
      to={`/persons/${person.person_id}`}
      className={`
        flex items-center gap-3 p-4 border border-black/10 rounded-sm
        hover:brightness-95 transition
        ${GENERATION_STYLES[generation]}
      `}
    >
      {arrow && <span className="text-fe-accent text-xl leading-none">{arrow}</span>}
      <div>
        <p className="font-bold text-sm">
          {person.first_name} {person.last_name}
        </p>
        {person.date_of_birth && (
          <p className="text-xs text-fe-ink/70">
            {formatBirthDate(person.date_of_birth)}
          </p>
        )}
      </div>
    </Link>
  )
}
