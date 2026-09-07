import { describe, expect, test } from 'vitest'
import { hasAdminAccess, hasApprovedAccess, parseGroups } from './auth'

describe('parseGroups', () => {
  test('parses a single group', () => {
    expect(parseGroups('[admin]')).toEqual(['admin'])
  })

  // Space-separated is the form API Gateway's JWT authorizer actually
  // produces -- captured from a live 403, see parseGroups' own comment.
  // Every multi-group test here used the comma form before, which meant
  // the suite agreed with the code's wrong assumption and stayed green
  // while every two-group user was locked out of the entire API.
  test('parses multiple groups, space-separated (the real format)', () => {
    expect(parseGroups('[approved admin]')).toEqual(['approved', 'admin'])
  })

  test('also tolerates a comma-separated list', () => {
    expect(parseGroups('[approved, admin]')).toEqual(['approved', 'admin'])
  })

  test('handles three groups', () => {
    expect(parseGroups('[pending approved admin]')).toEqual([
      'pending',
      'approved',
      'admin',
    ])
  })

  test('returns an empty array when the claim is absent', () => {
    expect(parseGroups(undefined)).toEqual([])
  })

  test('returns an empty array for an empty group list', () => {
    expect(parseGroups('[]')).toEqual([])
  })
})

describe('hasApprovedAccess', () => {
  test('true for approved', () => {
    expect(hasApprovedAccess('[approved]')).toBe(true)
  })

  test('true for admin', () => {
    expect(hasApprovedAccess('[admin]')).toBe(true)
  })

  // The exact case that broke in production: an approved user promoted
  // to admin (promotion adds admin, it doesn't remove approved).
  test('true when a user has both', () => {
    expect(hasApprovedAccess('[approved admin]')).toBe(true)
  })

  test('false for pending-only', () => {
    expect(hasApprovedAccess('[pending]')).toBe(false)
  })

  test('false when the claim is missing entirely', () => {
    expect(hasApprovedAccess(undefined)).toBe(false)
  })
})

describe('hasAdminAccess', () => {
  test('true for admin', () => {
    expect(hasAdminAccess('[admin]')).toBe(true)
  })

  test('false for approved alone -- admin is strictly narrower', () => {
    expect(hasAdminAccess('[approved]')).toBe(false)
  })

  test('true when a user has both approved and admin', () => {
    expect(hasAdminAccess('[approved admin]')).toBe(true)
  })

  test('false for pending-only', () => {
    expect(hasAdminAccess('[pending]')).toBe(false)
  })

  test('false when the claim is missing entirely', () => {
    expect(hasAdminAccess(undefined)).toBe(false)
  })
})
