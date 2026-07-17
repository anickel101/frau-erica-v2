import { AuthState } from '../hooks/useAuth'

// Shared shape behind gateView.ts's resolveGateView and
// adminGateView.ts's resolveAdminGateView -- both are "loading ->
// signedOut -> denied -> authorized" with a different group check and a
// different label for the denied state.
export function resolveAccessView<Denied extends string>(
  status: AuthState['status'],
  groups: string[],
  hasAccess: (groups: string[]) => boolean,
  deniedView: Denied,
): 'loading' | 'teaser' | Denied | 'authorized' {
  if (status === 'loading') return 'loading'
  if (status === 'signedOut') return 'teaser'
  if (!hasAccess(groups)) return deniedView
  return 'authorized'
}
