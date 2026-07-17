import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
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

  try {
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
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) {
      throw err
    }
    // Account already exists -- most likely a retry after a previous
    // partial failure (created but never added to the group). Fall
    // through to the group-add below instead of erroring, so
    // resubmitting the same request self-heals.
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
