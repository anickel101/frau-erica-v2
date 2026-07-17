import { resolveAccessView } from './accessView'
import { AuthState } from '../hooks/useAuth'

export type AdminGateView = 'loading' | 'teaser' | 'forbidden' | 'authorized'

// Shares resolveAccessView with gateView.ts, but gates on 'admin'
// specifically -- 'approved' alone is not sufficient for admin-only pages.
export function resolveAdminGateView(
  status: AuthState['status'],
  groups: string[],
): AdminGateView {
  return resolveAccessView(status, groups, (g) => g.includes('admin'), 'forbidden')
}
