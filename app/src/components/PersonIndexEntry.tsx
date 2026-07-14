import { Link } from 'react-router-dom'
import { Person } from '../data/mockPersons'
import { MOCK_FAMILY_LINK, getBirthLabel, getDeathLabel, getFullName } from '../utils/personDisplay'

export default function PersonIndexEntry({ person }: { person: Person }) {
  return (
    <p className="text-sm">
      <Link to={MOCK_FAMILY_LINK} className="text-fe-accent hover:text-fe-accent-dark">
        {getFullName(person)}
      </Link>{' '}
      (<em>{getBirthLabel(person)}</em> - <em>{getDeathLabel(person)}</em>)
    </p>
  )
}
