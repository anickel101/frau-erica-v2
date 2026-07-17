import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { parsePersonIdUpdateBody, type PersonIdUpdateBody } from '../lib/adminUserBody'
import { requireAdminAccess } from '../lib/auth'
import { requireEnv } from '../lib/env'
import { GROUPS } from '../lib/groups'
import { parseJsonBody } from '../lib/parseJsonBody'
import { jsonResponse } from '../lib/response'

const cognito = new CognitoIdentityProviderClient({})

async function userExists(userPoolId: string, email: string): Promise<boolean> {
  try {
    await cognito.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }),
    )
    return true
  } catch (err) {
    if (err instanceof UserNotFoundException) return false
    throw err
  }
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const body = parseJsonBody<PersonIdUpdateBody>(event.body)
  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const parsed = parsePersonIdUpdateBody(body)
  if (!parsed) {
    return jsonResponse(400, { error: 'email and a numeric personId are both required' })
  }
  const { email, personId } = parsed

  const userPoolId = requireEnv('COGNITO_USER_POOL_ID')

  if (await userExists(userPoolId, email)) {
    // Came through Request Access -- already exists in 'pending', with
    // custom:requester_name/connection set (see requestAccess.ts) but no
    // person_id yet and no usable credentials (created with
    // MessageAction: 'SUPPRESS').
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [{ Name: 'custom:person_id', Value: String(personId) }],
      }),
    )
    // Resends the invitation -- the first time this person actually
    // receives real login credentials.
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        MessageAction: 'RESEND',
      }),
    )
    await cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: GROUPS.PENDING,
      }),
    )
  } else {
    // No prior request on record -- admin-initiated from scratch (e.g.
    // bootstrapping the site's own first admin account).
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:person_id', Value: String(personId) },
        ],
        // Default DesiredDeliveryMediums is SMS, not EMAIL -- must be
        // explicit or the invitation goes nowhere (no phone number was
        // ever set) with no error. MessageAction left unset so Cognito's
        // own invitation email actually fires.
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    )
  }

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: email,
      GroupName: GROUPS.APPROVED,
    }),
  )

  return jsonResponse(200, { ok: true })
}
