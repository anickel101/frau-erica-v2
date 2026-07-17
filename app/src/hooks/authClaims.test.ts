import { describe, expect, test } from 'vitest'
import { parseIdTokenClaims } from './authClaims'

describe('parseIdTokenClaims', () => {
  test('parses a real groups array and numeric person_id', () => {
    expect(
      parseIdTokenClaims({ 'cognito:groups': ['admin'], 'custom:person_id': '23' }),
    ).toEqual({ groups: ['admin'], personId: 23 })
  })

  test('handles multiple groups', () => {
    expect(
      parseIdTokenClaims({ 'cognito:groups': ['approved', 'admin'] }).groups,
    ).toEqual(['approved', 'admin'])
  })

  test('groups defaults to an empty array when the claim is absent', () => {
    expect(parseIdTokenClaims({}).groups).toEqual([])
  })

  test('personId is null, not NaN, when the claim is absent', () => {
    expect(parseIdTokenClaims({ 'cognito:groups': ['pending'] }).personId).toBeNull()
  })

  test('personId is null for an empty string claim', () => {
    expect(parseIdTokenClaims({ 'custom:person_id': '' }).personId).toBeNull()
  })
})
