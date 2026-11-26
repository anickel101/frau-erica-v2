import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

// Renders its children for a signed-in admin and nothing for anyone else:
// the Edit links on public pages. Only what is shown is gated here -- the
// editing pages behind the links sit behind RequireAdmin, and the API
// checks the admin group on every save.
export default function AdminOnly({ children }: { children: ReactNode }) {
  const { status, groups } = useAuth()
  return status === 'signedIn' && groups.includes('admin') ? <>{children}</> : null
}
