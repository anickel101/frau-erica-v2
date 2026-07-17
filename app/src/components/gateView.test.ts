import { describe, expect, test } from 'vitest'
import { resolveGateView } from './gateView'

describe('resolveGateView', () => {
  test('loading while auth state is still resolving', () => {
    expect(resolveGateView('loading', [])).toBe('loading')
  })

  test('teaser when signed out', () => {
    expect(resolveGateView('signedOut', [])).toBe('teaser')
  })

  test('pending for a signed-in user with no approved/admin group', () => {
    expect(resolveGateView('signedIn', ['pending'])).toBe('pending')
  })

  test('pending for a signed-in user with no groups at all', () => {
    expect(resolveGateView('signedIn', [])).toBe('pending')
  })

  test('authorized for approved', () => {
    expect(resolveGateView('signedIn', ['approved'])).toBe('authorized')
  })

  test('authorized for admin', () => {
    expect(resolveGateView('signedIn', ['admin'])).toBe('authorized')
  })

  test('authorized when a user has both approved and admin', () => {
    expect(resolveGateView('signedIn', ['approved', 'admin'])).toBe('authorized')
  })
})
