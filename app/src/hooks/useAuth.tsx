import { createContext, useContext } from 'react'
import { AncestralLine } from '../data-access/gated/germline'

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
  // The family page that best represents this person -- their own
  // marriage/partnership if they have one, else the family they appear
  // in as a child. Resolved from the same lookup as personName. Null
  // until resolved, or if the lookup fails/finds no family at all.
  homeFamilyId: number | null
  // This person's own biological ancestor person_ids (GET /me/germline),
  // resolved once per sign-in like personName/homeFamilyId above -- null
  // until resolved, or if the lookup fails/finds none. A Set, not the
  // raw array, since PersonCard only ever needs .has() membership checks.
  germlineIds: Set<number> | null
  // One entry per immediate biological parent on record, each with the
  // furthest known ancestor down that specific line -- powers the
  // sidebar's "Furthest Ancestor (via {name})" links. From the same
  // lookup as germlineIds above. null until resolved (matching
  // germlineIds' own null-until-resolved convention); an empty array
  // means "resolved, no biological parents on record."
  ancestralLines: AncestralLine[] | null
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
