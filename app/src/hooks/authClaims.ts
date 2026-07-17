export interface AuthClaims {
  groups: string[]
  personId: number | null
}

// The ID token's own cognito:groups claim is a real JSON array (unlike
// the "[admin]" bracketed-string form API Gateway's JWT authorizer
// produces server-side -- that's specific to how it flattens claims for
// the Lambda, not how the token itself encodes them).
export function parseIdTokenClaims(payload: Record<string, unknown>): AuthClaims {
  const groupsClaim = payload['cognito:groups']
  const groups = Array.isArray(groupsClaim)
    ? groupsClaim.filter((g): g is string => typeof g === 'string')
    : []

  const personIdClaim = payload['custom:person_id']
  const personId =
    typeof personIdClaim === 'string' && personIdClaim !== ''
      ? Number(personIdClaim)
      : null

  return { groups, personId }
}
