import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { parsePersonIdUpdateBody, type PersonIdUpdateBody } from '../lib/adminUserBody'
import { requireAdminAccess } from '../lib/auth'
import { requireEnv } from '../lib/env'
import { parseJsonBody } from '../lib/parseJsonBody'
import { jsonResponse } from '../lib/response'

const cognito = new CognitoIdentityProviderClient({})

// Deliberately scoped to only custom:person_id -- fixing the specific
// "wrong person picked during approval" mistake, not a general profile
// editor. Changing group membership (revoking access, promoting to
// admin) is a separate, more sensitive action not covered here.
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

  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: [{ Name: 'custom:person_id', Value: String(personId) }],
    }),
  )

  return jsonResponse(200, { ok: true })
}
