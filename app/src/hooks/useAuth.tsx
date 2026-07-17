import { createContext, useContext } from 'react'

export interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn'
  idToken: string | null
  groups: string[]
  personId: number | null
  email: string | null
  // Resolved separately from the token (which only carries person_id, no
  // name) via a GET /persons/:id lookup once signed in -- null until that
  // lookup resolves, and stays null (falls back to email) if it fails or
  // there's no linked person_id at all.
  personName: string | null
}

export type LoginResult = { outcome: 'success' } | { outcome: 'newPasswordRequired' }

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>
  completeNewPassword: (newPassword: string) => Promise<void>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** Call this from any component under AuthProvider (mounted in main.tsx,
 * wraps the whole app) to read/act on the current sign-in state. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
