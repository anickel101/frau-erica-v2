import { apiFetch } from './apiClient'

export async function approveUser(email: string, personId: number): Promise<void> {
  await apiFetch('/admin/approve', {
    method: 'POST',
    body: { email, personId },
  })
}
