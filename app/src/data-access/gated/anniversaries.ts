import { apiFetch } from './apiClient'
import { AnniversaryEvent } from '../../types/anniversary'

export function getAnniversaries(
  idToken: string,
): Promise<{ events: AnniversaryEvent[] }> {
  return apiFetch('/anniversaries', idToken)
}
