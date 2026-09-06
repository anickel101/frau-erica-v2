import { apiFetch } from './apiClient'
import { FamilyDetail } from '../../types/family'

export function getFamilyById(familyId: number): Promise<FamilyDetail> {
  return apiFetch<FamilyDetail>(`/families/${familyId}`)
}
