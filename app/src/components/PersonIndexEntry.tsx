import { Link } from 'react-router-dom'
import { Person } from '../types/person'
import { getBirthLabel, getDeathLabel, getFullName } from '../utils/personDisplay'

export default function PersonIndexEntry({ person }: { person: Person }) {
  // linkedFamilyId is baked into the export (see scripts/export-data.ts).
  // Falls back to the /persons/:id resolver only for the rare case of no
  // linked family at all (e.g. no recorded parents or partners).
  const to =
    person.linkedFamilyId !== null
      ? `/family/${person.linkedFamilyId}`
      : `/persons/${person.person_id}`

  return (
    <p className="text-sm">
      <Link to={to} className="text-fe-accent hover:text-fe-accent-dark">
        {getFullName(person)}
      </Link>{' '}
      (<em>{getBirthLabel(person)}</em> - <em>{getDeathLabel(person)}</em>)
    </p>
  )
}
