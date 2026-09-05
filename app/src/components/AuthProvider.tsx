import { ReactNode, useEffect, useState } from 'react'
import { Amplify } from 'aws-amplify'
import {
  AuthSession,
  confirmResetPassword,
  confirmSignIn,
  fetchAuthSession,
  resetPassword,
  signIn,
  signOut,
} from 'aws-amplify/auth'
import { COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } from '../config/cognito'
import { getMyGermline } from '../data-access/gated/germline'
import { getPersonById } from '../data-access/gated/persons'
import { parseIdTokenClaims } from '../hooks/authClaims'
import { AuthContext, AuthContextValue, AuthState, LoginResult } from '../hooks/useAuth'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: COGNITO_USER_POOL_ID,
      userPoolClientId: COGNITO_CLIENT_ID,
    },
  },
})

const SIGNED_OUT_STATE: AuthState = {
  status: 'signedOut',
  idToken: null,
  groups: [],
  personId: null,
  email: null,
  personName: null,
  homeFamilyId: null,
  germlineIds: null,
  ancestralLines: null,
}

function stateFromSession(session: AuthSession): AuthState {
  const idToken = session.tokens?.idToken
  if (!idToken) return SIGNED_OUT_STATE
  const payload = idToken.payload as Record<string, unknown>
  const { groups, personId } = parseIdTokenClaims(payload)
  return {
    status: 'signedIn',
    idToken: idToken.toString(),
    groups,
    personId,
    email: typeof payload.email === 'string' ? payload.email : null,
    // None of these are on the token -- all resolved by the effects
    // below, once idToken/personId are in state.
    personName: null,
    homeFamilyId: null,
    germlineIds: null,
    ancestralLines: null,
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  // Amplify's fetchAuthSession() is always async (no synchronous
  // "is there a cached user at all" check the way
  // amazon-cognito-identity-js's pool.getCurrentUser() offered) -- every
  // visitor briefly passes through 'loading' below, resolving to
  // 'signedOut' almost immediately (no network call needed) when there's
  // nothing in storage. A brief, one-frame loading state instead of an
  // instant signedOut render, not a real regression.
  const [state, setState] = useState<AuthState>({
    ...SIGNED_OUT_STATE,
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false
    fetchAuthSession()
      .then((session) => {
        if (!cancelled) setState(stateFromSession(session))
      })
      .catch(() => {
        if (!cancelled) setState(SIGNED_OUT_STATE)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Resolves the signed-in user's family-tree name and "home" family page
  // via their linked person_id -- runs once per sign-in (dependencies
  // only change on status/personId/idToken transitions, not on
  // personName/homeFamilyId themselves updating). A pending account with
  // no person_id yet, or a lookup failure, just leaves both null --
  // callers fall back to email, and hide the "go to my family page" link.
  useEffect(() => {
    if (state.status !== 'signedIn' || state.personId === null || !state.idToken) return
    let cancelled = false
    getPersonById(state.personId, state.idToken)
      .then((person) => {
        if (cancelled) return
        // Prefer the family they're a partner in (their own household)
        // over the family they appear in as a child -- more clearly
        // "theirs" as a homepage. Falls back to the child family for
        // anyone not yet a partner in any Families row.
        const homeFamilyId = person.familyIdsAsPartner[0] ?? person.familyIdAsChild
        setState((prev) =>
          prev.status === 'signedIn'
            ? {
                ...prev,
                personName: `${person.first_name} ${person.last_name}`.trim(),
                homeFamilyId,
              }
            : prev,
        )
      })
      .catch(() => {
        // Name/home-family are a nice-to-have -- a failed lookup
        // shouldn't affect sign-in itself, both just stay null.
      })
    return () => {
      cancelled = true
    }
  }, [state.status, state.personId, state.idToken])

  // Resolves this user's germline (their own biological ancestor
  // person_ids, plus one furthest-ancestor line per immediate parent) --
  // same "resolve once per sign-in, tolerate failure by leaving null"
  // shape as the personName/homeFamilyId effect above, kept separate
  // since it's a different endpoint/concern with no reason to couple
  // their success/failure or block one on the other.
  useEffect(() => {
    if (state.status !== 'signedIn' || state.personId === null || !state.idToken) return
    let cancelled = false
    getMyGermline(state.idToken)
      .then(({ personIds, ancestralLines }) => {
        if (cancelled) return
        setState((prev) =>
          prev.status === 'signedIn'
            ? { ...prev, germlineIds: new Set(personIds), ancestralLines }
            : prev,
        )
      })
      .catch(() => {
        // Germline is a nice-to-have (marker highlighting, sidebar
        // links) -- a failed lookup shouldn't affect sign-in itself.
      })
    return () => {
      cancelled = true
    }
  }, [state.status, state.personId, state.idToken])

  async function login(email: string, password: string): Promise<LoginResult> {
    const { nextStep } = await signIn({ username: email, password })
    if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      return { outcome: 'newPasswordRequired' }
    }
    setState(stateFromSession(await fetchAuthSession()))
    return { outcome: 'success' }
  }

  // No held CognitoUser instance needed (unlike amazon-cognito-identity-js,
  // where the NEW_PASSWORD_REQUIRED challenge lived on a specific client
  // object) -- Amplify tracks the in-flight sign-in challenge internally,
  // keyed by username, so confirmSignIn() just resumes it.
  async function completeNewPassword(newPassword: string): Promise<void> {
    await confirmSignIn({ challengeResponse: newPassword })
    setState(stateFromSession(await fetchAuthSession()))
  }

  async function logout(): Promise<void> {
    await signOut()
    setState(SIGNED_OUT_STATE)
  }

  // Sends a verification code to the account's verified email via
  // Cognito's own delivery (same mechanism as the admin-approval
  // invitation).
  async function requestPasswordReset(email: string): Promise<void> {
    await resetPassword({ username: email })
  }

  async function confirmPasswordReset(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await confirmResetPassword({ username: email, confirmationCode: code, newPassword })
  }

  const value: AuthContextValue = {
    ...state,
    login,
    completeNewPassword,
    logout,
    requestPasswordReset,
    confirmPasswordReset,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
