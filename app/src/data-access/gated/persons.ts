import { apiFetch } from './apiClient'
import { Person } from '../../types/person'

export function getPersonById(personId: number, idToken: string): Promise<Person> {
  return apiFetch<Person>(`/persons/${personId}`, idToken)
}
