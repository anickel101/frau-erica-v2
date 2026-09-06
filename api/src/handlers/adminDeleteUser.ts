import {
  AdminDeleteUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { isSelf, requireAdminAccess } from '../lib/auth'
import { requireEnv } from '../lib/env'
import { GROUPS } from '../lib/groups'
import { jsonResponse } from '../lib/response'

const cognito = new CognitoIdentityProviderClient({})

// Deletes an account outright. Used both to deny a request (a pending
// account created by requestAccess.ts) and to remove an existing user --
// the same operation either way, since a denied request is just an
// account nobody ever approved.
//
// Deliberately a hard delete rather than a 'denied' group. The obvious
// argument for keeping a denied state is that it records the decision
// and stops the same person reappearing, but it doesn't achieve the
// second part: requestAccess.ts intentionally swallows
// UsernameExistsException and still emails the archivist, so a denied
// person resubmitting notifies them regardless. That leaves a state to
// reason about everywhere, for a record nobody reads.
export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const email = event.pathParameters?.email
  if (!email) {
    return jsonResponse(400, { error: 'Missing email path parameter' })
  }

  if (isSelf(event, email)) {
    return jsonResponse(400, { error: 'You cannot delete your own account' })
  }

  const userPoolId = requireEnv('COGNITO_USER_POOL_ID')

  // Admins have to be demoted before they can be deleted. Not because
  // deleting one is never right, but because it's the single most
  // damaging accidental click available here -- losing the last admin
  // means losing every admin route, recoverable only from the AWS
  // console. Making it two deliberate steps costs nothing and removes
  // the possibility of doing it by accident.
  let groups: string[]
  try {
    const response = await cognito.send(
      new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: email }),
    )
    groups = (response.Groups ?? [])
      .map((group) => group.GroupName)
      .filter((name): name is string => Boolean(name))
  } catch (err) {
    // Already gone -- treat as success rather than an error, so a double
    // click or a stale page doesn't surface a scary failure for an
    // outcome the admin wanted anyway.
    if (err instanceof UserNotFoundException) {
      return jsonResponse(200, { ok: true })
    }
    throw err
  }

  if (groups.includes(GROUPS.ADMIN)) {
    return jsonResponse(400, {
      error: 'Remove admin access from this account before deleting it',
    })
  }

  try {
    await cognito.send(
      new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email }),
    )
  } catch (err) {
    if (!(err instanceof UserNotFoundException)) throw err
  }

  return jsonResponse(200, { ok: true })
}
