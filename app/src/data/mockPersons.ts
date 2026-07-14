import raw from './mockPersons.json'

export interface Person {
  person_id: number
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  date_of_birth: string | null
  birth_year: number | null
  date_of_death: string | null
  death_year: number | null
}

function sortKey(person: Person): string {
  return (person.last_name || person.first_name).toLowerCase()
}

export const mockPersons: Person[] = (raw as Person[]).slice().sort((a, b) => {
  const key = sortKey(a).localeCompare(sortKey(b))
  return key !== 0 ? key : a.first_name.localeCompare(b.first_name)
})
