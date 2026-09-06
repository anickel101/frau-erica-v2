import { apiFetch } from './apiClient'
import { PersonDetail } from '../../types/person'

export function getPersonById(personId: number): Promise<PersonDetail> {
  return apiFetch<PersonDetail>(`/persons/${personId}`)
}
