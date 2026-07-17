import { Link } from 'react-router-dom'
import { formatBirthDate } from '../utils/dateDisplay'
import { LinkedPersonSummary } from '../types/person'

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
  person: LinkedPersonSummary
  generation: Generation
}) {
  const arrow = DIRECTION_ARROW[generation]
  // linkedFamilyId is precomputed server-side (see api/'s FamilyDetail) --
  // goes straight to their family page, no /persons/:id resolver hop.
  // Falls back to the resolver only for the rare case of no linked
  // family at all (e.g. a person with no recorded parents or partners).
  const to =
    person.linkedFamilyId !== null
      ? `/family/${person.linkedFamilyId}`
      : `/persons/${person.person_id}`

  return (
    <Link
      to={to}
      className={`
        flex items-center gap-3 p-4 border border-black/10 rounded-sm
        hover:brightness-95 transition
        ${GENERATION_STYLES[generation]}
      `}
    >
      {/* Fixed-width slot, always rendered (even when arrow is null for
          "couple") so the name text lines up at the same x-position
          across all three generations -- couple boxes have no arrow but
          still reserve its space. */}
      <span className="text-fe-accent text-3xl leading-none w-8 shrink-0 text-center">
        {arrow}
      </span>
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
