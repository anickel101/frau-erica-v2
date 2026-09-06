import { apiFetch } from './apiClient'
import { AnniversaryEvent } from '../../types/anniversary'

export function getAnniversaries(): Promise<{ events: AnniversaryEvent[] }> {
  return apiFetch('/anniversaries')
}
