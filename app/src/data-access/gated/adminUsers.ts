import { apiFetch } from './apiClient'

export interface AdminUserSummary {
  email: string
  groups: string[]
  personId: number | null
}

export async function listAdminUsers(idToken: string): Promise<AdminUserSummary[]> {
  const { users } = await apiFetch<{ users: AdminUserSummary[] }>('/admin/users', idToken)
  return users
}

export async function updateUserPersonId(
  email: string,
  personId: number,
  idToken: string,
): Promise<void> {
  await apiFetch('/admin/users', idToken, {
    method: 'PATCH',
    body: { email, personId },
  })
}
