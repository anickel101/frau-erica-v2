import { resolveAccessView } from './accessView'
import { AuthState } from '../hooks/useAuth'

export type GateView = 'loading' | 'teaser' | 'pending' | 'authorized'

// Pure decision logic, kept separate from RequireApproved.tsx so that
// file can stay component-only (Fast Refresh requirement) and so this
// access-control logic can be unit tested directly -- a mistake here is
// a real bug, same reasoning already applied to the API's own
// handler-level authorization tests.
export function resolveGateView(status: AuthState['status'], groups: string[]): GateView {
  return resolveAccessView(
    status,
    groups,
    (g) => g.includes('approved') || g.includes('admin'),
    'pending',
  )
}
