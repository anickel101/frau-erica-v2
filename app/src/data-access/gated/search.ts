import { apiFetch } from './apiClient'
import { PersonSummary } from '../../types/person'

export async function searchPersons(query: string): Promise<PersonSummary[]> {
  const { results } = await apiFetch<{ results: PersonSummary[] }>(
    `/search?q=${encodeURIComponent(query)}`,
  )
  return results
}
