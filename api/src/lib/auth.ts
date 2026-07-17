import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { GROUPS } from './groups'
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
  return groups.includes(GROUPS.APPROVED) || groups.includes(GROUPS.ADMIN)
}

// admin is a strictly narrower, more sensitive check than
// hasApprovedAccess -- 'approved' alone is not sufficient. Used only by
// handlers that can create/modify accounts (adminApproveUser,
// adminListUsers, adminUpdateUser).
export function hasAdminAccess(groupsClaim: string | undefined): boolean {
  return parseGroups(groupsClaim).includes(GROUPS.ADMIN)
}

function getGroupsClaim(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): string | undefined {
  // @types/aws-lambda's claims type is broader than reality here --
  // API Gateway's JWT authorizer always serializes claims as strings.
  return event.requestContext.authorizer.jwt.claims['cognito:groups'] as
    string | undefined
}

// Shared shape behind requireApprovedAccess/requireAdminAccess -- both
// are "extract claim -> check -> 403 or null" with a different check and
// error message. The Cognito authorizer already guarantees a valid token
// got this far (that's a 401 concern, handled before the Lambda ever
// runs); this is the separate, page-type-level "are they actually
// allowed" check.
function requireGroup(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  check: (groupsClaim: string | undefined) => boolean,
  errorMessage: string,
): APIGatewayProxyResultV2 | null {
  if (!check(getGroupsClaim(event))) {
    return jsonResponse(403, { error: errorMessage })
  }
  return null
}

export function requireApprovedAccess(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): APIGatewayProxyResultV2 | null {
  return requireGroup(
    event,
    hasApprovedAccess,
    'Your account has not been approved for access yet',
  )
}

export function requireAdminAccess(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): APIGatewayProxyResultV2 | null {
  return requireGroup(event, hasAdminAccess, 'Admin access required')
}
