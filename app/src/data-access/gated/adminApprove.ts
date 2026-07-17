import { apiFetch } from './apiClient'

export async function approveUser(
  email: string,
  personId: number,
  idToken: string,
): Promise<void> {
  await apiFetch('/admin/approve', idToken, {
    method: 'POST',
    body: { email, personId },
  })
}
