import { apiFetch } from './apiClient'
import { PersonDetail } from '../../types/person'

export function getPersonById(personId: number, idToken: string): Promise<PersonDetail> {
  return apiFetch<PersonDetail>(`/persons/${personId}`, idToken)
}
