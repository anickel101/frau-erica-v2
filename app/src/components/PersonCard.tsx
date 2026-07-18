import { Link } from 'react-router-dom'
import { formatBirthDate } from '../utils/dateDisplay'
import { LinkedPersonSummary } from '../types/person'

type Generation = 'grandparent' | 'couple' | 'child'

const GENERATION_STYLES: Record<Generation, string> = {
  grandparent: 'bg-fe-gen-grandparent',
  couple: 'bg-fe-gen-couple',
  child: 'bg-fe-gen-child',
}

// Only the couple boxes get a generation-colored (and thicker) border --
// grandparent/child keep the original neutral 1px hairline.
const GENERATION_BORDER: Record<Generation, string> = {
  grandparent: 'border border-black/10',
  couple: 'border-2 border-fe-gen-couple-dark',
  child: 'border border-black/10',
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
  isInGermline = false,
}: {
  person: LinkedPersonSummary
  generation: Generation
  // True when this person is one of the logged-in user's own biological
  // ancestors (see hooks/useAuth.tsx's germlineIds) -- overrides the
  // normal generation-based arrow with a diamond, letting someone trace
  // their own direct line through the tree. Orthogonal to generation:
  // even a "couple" box (which has no arrow at all today) shows a
  // diamond when applicable, e.g. browsing up to an ancestor's own
  // Family page.
  isInGermline?: boolean
}) {
  const glyph = isInGermline ? '◆' : DIRECTION_ARROW[generation]
  // linkedFamilyId is precomputed server-side (see api/'s FamilyDetail) --
  // goes straight to their family page, no /persons/:id resolver hop.
  // Falls back to the resolver only for the rare case of no linked
  // family at all (e.g. a person with no recorded parents or partners).
  const to =
    person.linkedFamilyId !== null
      ? `/family/${person.linkedFamilyId}`
      : `/persons/${person.person_id}`

  return (
    // A plain, non-interactive wrapper -- not the Link itself -- so the
    // alternate-family triangle below can be a second, independently
    // targeted Link layered on top via absolute positioning. There's no
    // valid way to nest a second <a> (or even a <button>) inside the
    // main Link's own <a>; this keeps both as siblings instead.
    <div className="relative">
      <Link
        to={to}
        className={`
          flex items-center gap-3 p-4 rounded-sm
          hover:brightness-95 transition
          ${GENERATION_STYLES[generation]} ${GENERATION_BORDER[generation]}
        `}
      >
        {/* Fixed-width slot, always rendered (even when glyph is null for
            a non-germline "couple") so the name text lines up at the same
            x-position across all three generations -- couple boxes have
            no arrow but still reserve its space. */}
        <span className="text-fe-accent text-3xl leading-none w-8 shrink-0 text-center">
          {glyph}
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
      {/* Only ever set for the featured couple (person_1/person_2) --
          see api/'s getFamilyById -- but the generation check here is a
          second, defensive gate in case that ever changes. Points to
          the other Families row this person partners in (widowed/
          remarried, etc). Always points right -- a single fixed
          direction, nothing in the spec calls for it to vary. */}
      {generation === 'couple' && person.otherFamilyId != null && (
        <Link
          to={`/family/${person.otherFamilyId}`}
          aria-label={`${person.first_name}'s other family`}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-fe-accent text-lg leading-none hover:text-fe-accent-dark"
        >
          ▶
        </Link>
      )}
    </div>
  )
}
