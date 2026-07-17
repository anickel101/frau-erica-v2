import { apiFetch } from './apiClient'
import { PersonSummary } from '../../types/person'

export async function searchPersons(
  query: string,
  idToken: string,
): Promise<PersonSummary[]> {
  const { results } = await apiFetch<{ results: PersonSummary[] }>(
    `/search?q=${encodeURIComponent(query)}`,
    idToken,
  )
  return results
}
