import {
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireAdminAccess } from '../lib/auth'
import { requireEnv } from '../lib/env'
import { GROUPS } from '../lib/groups'
import { parseJsonBody } from '../lib/parseJsonBody'
import { jsonResponse } from '../lib/response'

const cognito = new CognitoIdentityProviderClient({})

interface UpdateGroupBody {
  action?: 'promote' | 'demote'
}

// Promotes an approved user to admin, or demotes an admin back to
// approved -- the only two group transitions this project's design
// supports (nobody is ever placed in 'pending'; see
// adminApproveUser.ts). Deliberately a separate route from
// PATCH /admin/users (person_id correction) -- granting/revoking admin
// power is a meaningfully more sensitive action than fixing a
// data-entry mistake, and gets its own explicit, auditable action
// rather than being folded into that body shape.
export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const email = event.pathParameters?.email
  if (!email) {
    return jsonResponse(400, { error: 'Missing email path parameter' })
  }

  // Self-protection: an admin can't change their own group through this
  // route -- avoids a stray click locking the only admin out of the
  // admin pages entirely. Email is this pool's Cognito username (the
  // sole sign-in identifier), so comparing it against the caller's own
  // token claim is the same identity assumption adminApproveUser.ts
  // already makes.
  const callerEmail = event.requestContext.authorizer.jwt.claims.email
  if (callerEmail === email) {
    return jsonResponse(400, { error: 'You cannot change your own group' })
  }

  const body = parseJsonBody<UpdateGroupBody>(event.body)
  if (!body || (body.action !== 'promote' && body.action !== 'demote')) {
    return jsonResponse(400, { error: 'action must be "promote" or "demote"' })
  }

  const userPoolId = requireEnv('COGNITO_USER_POOL_ID')

  if (body.action === 'promote') {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: GROUPS.ADMIN,
      }),
    )
  } else {
    await cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: GROUPS.ADMIN,
      }),
    )
  }

  return jsonResponse(200, { ok: true })
}
