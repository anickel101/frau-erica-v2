import { describe, expect, test } from 'vitest'
import { resolveHomeDestination } from './homeDestination'

const APPROVED = ['approved']

describe('resolveHomeDestination', () => {
  test('sends an approved member to their person route, which resolves the family', () => {
    expect(resolveHomeDestination('signedIn', 18, APPROVED)).toEqual({
      kind: 'person',
      personId: 18,
    })
  })

  test('admins are sent too -- admin implies approved access', () => {
    expect(resolveHomeDestination('signedIn', 18, ['admin'])).toEqual({
      kind: 'person',
      personId: 18,
    })
  })

  test('a signed-out visitor gets the home page', () => {
    expect(resolveHomeDestination('signedOut', null, [])).toEqual({ kind: 'home' })
  })

  // The point of deciding on personId rather than homeFamilyId: person_id
  // is on the ID token, so there is never a "still looking it up" state
  // to wait through. Nothing here can return 'resolving' once the
  // session itself is known.
  test('never waits once the session has resolved', () => {
    for (const groups of [APPROVED, ['admin'], ['pending'], []]) {
      for (const personId of [18, null]) {
        expect(resolveHomeDestination('signedIn', personId, groups).kind).not.toBe(
          'resolving',
        )
      }
    }
  })

  test('sends an account with no linked person to the home page', () => {
    expect(resolveHomeDestination('signedIn', null, APPROVED)).toEqual({
      kind: 'home',
    })
  })

  // Redirecting them just swaps the archive's front door for "your
  // access is still pending", which is a worse landing.
  test('leaves a pending account on the home page', () => {
    expect(resolveHomeDestination('signedIn', 18, ['pending'])).toEqual({
      kind: 'home',
    })
  })

  test('leaves an account with no groups at all on the home page', () => {
    expect(resolveHomeDestination('signedIn', 18, [])).toEqual({ kind: 'home' })
  })

  // Not 'home' -- every visitor passes through 'loading' for a frame,
  // and returning 'home' there would flash the welcome page at someone
  // who is about to be redirected away from it.
  test('waits while the session itself is still resolving', () => {
    expect(resolveHomeDestination('loading', null, [])).toEqual({
      kind: 'resolving',
    })
  })
})
