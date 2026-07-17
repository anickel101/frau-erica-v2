import { describe, expect, test } from 'vitest'
import { resolveAdminGateView } from './adminGateView'

describe('resolveAdminGateView', () => {
  test('loading while auth state is still resolving', () => {
    expect(resolveAdminGateView('loading', [])).toBe('loading')
  })

  test('teaser when signed out', () => {
    expect(resolveAdminGateView('signedOut', [])).toBe('teaser')
  })

  test('forbidden for a signed-in approved-only user', () => {
    expect(resolveAdminGateView('signedIn', ['approved'])).toBe('forbidden')
  })

  test('forbidden for a signed-in user with no groups at all', () => {
    expect(resolveAdminGateView('signedIn', [])).toBe('forbidden')
  })

  test('authorized for admin', () => {
    expect(resolveAdminGateView('signedIn', ['admin'])).toBe('authorized')
  })

  test('authorized when a user has both approved and admin', () => {
    expect(resolveAdminGateView('signedIn', ['approved', 'admin'])).toBe('authorized')
  })
})
