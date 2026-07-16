import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { jsonResponse } from './response'

// API Gateway HTTP API's JWT authorizer serializes the cognito:groups
// claim as a Java-style toString() of the list -- e.g. "[admin]" or
// "[approved, admin]" -- not a real JSON array. Confirmed empirically
// against a live deployed authorizer, not assumed from docs.
export function parseGroups(groupsClaim: string | undefined): string[] {
  if (!groupsClaim) return []
  return groupsClaim
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
}

// Gating is page-type-level, not per-record (see app/CLAUDE.md's
// auth/gating plan) -- a 'pending' user (awaiting approval) should not
// be able to query gated content at all, only 'approved'/'admin'.
export function hasApprovedAccess(groupsClaim: string | undefined): boolean {
  const groups = parseGroups(groupsClaim)
  return groups.includes('approved') || groups.includes('admin')
}

// Shared guard for every gated (persons/families/search) handler --
// returns a 403 response to return early with, or null if the caller is
// cleared to proceed. The Cognito authorizer already guarantees a valid
// token got this far (that's a 401 concern, handled before the Lambda
// ever runs); this is the separate, page-type-level "are they actually
// approved" check.
export function requireApprovedAccess(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): APIGatewayProxyResultV2 | null {
  // @types/aws-lambda's claims type is broader than reality here --
  // API Gateway's JWT authorizer always serializes claims as strings.
  const groupsClaim = event.requestContext.authorizer.jwt.claims['cognito:groups'] as
    string | undefined
  if (!hasApprovedAccess(groupsClaim)) {
    return jsonResponse(403, {
      error: 'Your account has not been approved for access yet',
    })
  }
  return null
}
