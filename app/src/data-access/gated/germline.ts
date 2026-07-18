import { apiFetch } from './apiClient'
import { LinkedPersonSummary } from '../../types/person'

export interface GermlineResponse {
  personIds: number[]
  furthestAncestor: LinkedPersonSummary | null
}

export function getMyGermline(idToken: string): Promise<GermlineResponse> {
  return apiFetch('/me/germline', idToken)
}
