import { apiFetch } from './apiClient'

// Matches api/src/lib/types.ts's PersonSummary shape.
export interface PersonSummary {
  person_id: number
  first_name: string
  last_name: string
  date_of_birth?: string
}

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
