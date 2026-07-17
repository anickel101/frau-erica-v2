import { describe, expect, test } from 'vitest'
import { hasAdminAccess, hasApprovedAccess, parseGroups } from './auth'

describe('parseGroups', () => {
  test('parses a single group', () => {
    expect(parseGroups('[admin]')).toEqual(['admin'])
  })

  test('parses multiple groups', () => {
    expect(parseGroups('[approved, admin]')).toEqual(['approved', 'admin'])
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

  test('true when a user has both', () => {
    expect(hasApprovedAccess('[approved, admin]')).toBe(true)
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
    expect(hasAdminAccess('[approved, admin]')).toBe(true)
  })

  test('false for pending-only', () => {
    expect(hasAdminAccess('[pending]')).toBe(false)
  })

  test('false when the claim is missing entirely', () => {
    expect(hasAdminAccess(undefined)).toBe(false)
  })
})
