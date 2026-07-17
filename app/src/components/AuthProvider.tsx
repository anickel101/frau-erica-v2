import { ReactNode, useEffect, useRef, useState } from 'react'
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'
import { COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } from '../config/cognito'
import { getPersonById } from '../data-access/gated/persons'
import { parseIdTokenClaims } from '../hooks/authClaims'
import { AuthContext, AuthContextValue, AuthState, LoginResult } from '../hooks/useAuth'

const pool = new CognitoUserPool({
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_CLIENT_ID,
})

const SIGNED_OUT_STATE: AuthState = {
  status: 'signedOut',
  idToken: null,
  groups: [],
  personId: null,
  email: null,
  personName: null,
}

function stateFromSession(session: CognitoUserSession): AuthState {
  const idToken = session.getIdToken()
  const payload = idToken.decodePayload() as Record<string, unknown>
  const { groups, personId } = parseIdTokenClaims(payload)
  return {
    status: 'signedIn',
    idToken: idToken.getJwtToken(),
    groups,
    personId,
    email: typeof payload.email === 'string' ? payload.email : null,
    // Not on the token -- resolved by the effect below, once idToken/
    // personId are in state.
    personName: null,
  }
}

// Synchronous check, used as useState's lazy initializer -- if there's
// no cached user at all, we already know the answer (signedOut) without
// needing an effect. If one exists, initial state stays 'loading' while
// the effect below asynchronously validates/refreshes the session.
function initialAuthState(): AuthState {
  return pool.getCurrentUser()
    ? { ...SIGNED_OUT_STATE, status: 'loading' }
    : SIGNED_OUT_STATE
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialAuthState)

  // Holds the CognitoUser instance between login() and completeNewPassword()
  // -- the NEW_PASSWORD_REQUIRED challenge session lives on that specific
  // instance, so the same object must be reused, not recreated.
  const pendingUserRef = useRef<CognitoUser | null>(null)

  useEffect(() => {
    const currentUser = pool.getCurrentUser()
    if (!currentUser) return

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        setState(SIGNED_OUT_STATE)
        return
      }
      setState(stateFromSession(session))
    })
  }, [])

  // Resolves the signed-in user's family-tree name via their linked
  // person_id -- runs once per sign-in (dependencies only change on
  // status/personId/idToken transitions, not on personName itself
  // updating). A pending account with no person_id yet, or a lookup
  // failure, just leaves personName null -- callers fall back to email.
  useEffect(() => {
    if (state.status !== 'signedIn' || state.personId === null || !state.idToken) return
    let cancelled = false
    getPersonById(state.personId, state.idToken)
      .then((person) => {
        if (cancelled) return
        setState((prev) =>
          prev.status === 'signedIn'
            ? { ...prev, personName: `${person.first_name} ${person.last_name}`.trim() }
            : prev,
        )
      })
      .catch(() => {
        // Name is a nice-to-have -- a failed lookup shouldn't affect
        // sign-in itself, personName just stays null.
      })
    return () => {
      cancelled = true
    }
  }, [state.status, state.personId, state.idToken])

  function login(email: string, password: string): Promise<LoginResult> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: pool })
      pendingUserRef.current = cognitoUser
      cognitoUser.authenticateUser(
        new AuthenticationDetails({ Username: email, Password: password }),
        {
          onSuccess: (session) => {
            setState(stateFromSession(session))
            resolve({ outcome: 'success' })
          },
          onFailure: (err) => reject(err),
          newPasswordRequired: () => resolve({ outcome: 'newPasswordRequired' }),
        },
      )
    })
  }

  function completeNewPassword(newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = pendingUserRef.current
      if (!cognitoUser) {
        reject(new Error('No sign-in in progress'))
        return
      }
      cognitoUser.completeNewPasswordChallenge(
        newPassword,
        {},
        {
          onSuccess: (session) => {
            setState(stateFromSession(session))
            resolve()
          },
          onFailure: (err) => reject(err),
        },
      )
    })
  }

  function logout() {
    pool.getCurrentUser()?.signOut()
    pendingUserRef.current = null
    setState(SIGNED_OUT_STATE)
  }

  // Sends a verification code to the account's verified email via
  // Cognito's own delivery (same mechanism as the admin-approval
  // invitation). Reuses pendingUserRef -- confirmPasswordReset below
  // calls confirmPassword() on this same CognitoUser instance.
  function requestPasswordReset(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: pool })
      pendingUserRef.current = cognitoUser
      cognitoUser.forgotPassword({
        onSuccess: () => resolve(),
        onFailure: (err) => reject(err),
        inputVerificationCode: () => resolve(),
      })
    })
  }

  function confirmPasswordReset(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser =
        pendingUserRef.current ?? new CognitoUser({ Username: email, Pool: pool })
      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(),
        onFailure: (err) => reject(err),
      })
    })
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
