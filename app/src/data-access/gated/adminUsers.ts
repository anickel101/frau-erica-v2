import { apiFetch } from './apiClient'

export interface AdminUserSummary {
  email: string
  groups: string[]
  personId: number | null
  // Resolved server-side from the linked person_id -- null for pending
  // accounts (no person_id yet) or the rare unresolvable person_id.
  fullName: string | null
  // Only ever set for accounts created via Request Access -- null for
  // anyone an admin bootstrapped directly.
  requesterName: string | null
  connection: string | null
}

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const { users } = await apiFetch<{ users: AdminUserSummary[] }>('/admin/users')
  return users
}

export async function updateUserPersonId(email: string, personId: number): Promise<void> {
  await apiFetch('/admin/users', {
    method: 'PATCH',
    body: { email, personId },
  })
}

export async function updateUserGroup(
  email: string,
  action: 'promote' | 'demote',
): Promise<void> {
  await apiFetch(`/admin/users/${encodeURIComponent(email)}/group`, {
    method: 'PATCH',
    body: { action },
  })
}
