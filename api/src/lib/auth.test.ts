import { describe, expect, test } from 'vitest'
import { hasApprovedAccess, parseGroups } from './auth'

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
