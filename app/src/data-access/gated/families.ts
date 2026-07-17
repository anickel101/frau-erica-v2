import { apiFetch } from './apiClient'
import { FamilyDetail } from '../../types/family'

export function getFamilyById(familyId: number, idToken: string): Promise<FamilyDetail> {
  return apiFetch<FamilyDetail>(`/families/${familyId}`, idToken)
}
