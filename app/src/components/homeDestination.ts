import { AuthState } from '../hooks/useAuth'

export type HomeDestination =
  // The session itself hasn't resolved yet. Render nothing rather than
  // the home page: a signed-in member would see the welcome flash past
  // on its way to being replaced.
  | { kind: 'resolving' }
  // Send them to /persons/:id, which resolves to their family page.
  | { kind: 'person'; personId: number }
  // Signed out, not approved, or not linked to a person -- the home page
  // is the right landing for all three.
  | { kind: 'home' }

// Where a signed-in family member should land, on login and on any later
// visit to "/".
//
// Deliberately decided from personId, NOT from homeFamilyId. person_id
// rides on the Cognito ID token as a custom attribute, so it is known
// synchronously the moment the session resolves -- no network call, and
// nothing to wait for. homeFamilyId needs a GET /persons/:id lookup, and
// waiting on that meant inventing a third "not yet known" state on the
// auth context purely to answer this one question.
//
// /persons/:id then does the resolution, which it already existed to do:
// same familyIdsAsPartner[0] ?? familyIdAsChild rule, same redirect,
// already gated by RequireApproved, already handling not-found, no-family
// and error. Sending people through it keeps one implementation of "which
// family page is this person's" rather than making a second.
//
// Pure decision logic, kept out of HomePage so it can be tested directly
// -- same pattern as gateView.ts/adminGateView.ts. The failure modes here
// are a permanently blank page or a redirect loop, which are worth
// pinning down rather than eyeballing.
export function resolveHomeDestination(
  status: AuthState['status'],
  personId: AuthState['personId'],
  groups: string[],
): HomeDestination {
  if (status === 'loading') return { kind: 'resolving' }
  if (status !== 'signedIn') return { kind: 'home' }

  // Approved-only. Redirecting a pending account would swap the
  // archive's front door for "your access is still pending", which is a
  // worse landing than the welcome page.
  if (!groups.includes('approved') && !groups.includes('admin')) {
    return { kind: 'home' }
  }

  // No linked person means there's no family page to find.
  if (personId === null) return { kind: 'home' }

  return { kind: 'person', personId }
}
