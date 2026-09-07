import { Link } from 'react-router-dom'
import { Person } from '../types/person'
import { getFullName } from '../utils/personDisplay'

export default function PersonIndexEntry({ person }: { person: Person }) {
  // linkedFamilyId is baked into the export (see scripts/export-data.ts).
  // Falls back to the /persons/:id resolver only for the rare case of no
  // linked family at all (e.g. no recorded parents or partners).
  const to =
    person.linkedFamilyId !== null
      ? `/family/${person.linkedFamilyId}`
      : `/persons/${person.person_id}`

  return (
    // break-inside-avoid keeps a name from splitting across a column break
    // in PersonIndexSection's multi-column layout. Dates dropped -- they
    // already appear on this person's own Family page, and repeating them
    // here just adds noise to a page whose only job is finding a name fast.
    <p className="text-xs break-inside-avoid mb-1">
      <Link to={to} className="text-fe-link hover:text-fe-link-dark">
        {getFullName(person)}
      </Link>
    </p>
  )
}
