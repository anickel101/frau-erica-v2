import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { requireEnv } from '../lib/env'
import { GROUPS } from '../lib/groups'
import { parseJsonBody } from '../lib/parseJsonBody'
import { isVerificationAcceptable, verifyRecaptcha } from '../lib/recaptcha'
import { jsonResponse } from '../lib/response'
import { getRecaptchaSecret } from '../lib/secrets'
import { sendAdminNotification } from '../lib/ses'

const cognito = new CognitoIdentityProviderClient({})

interface RequestBody {
  name?: string
  email?: string
  connection?: string
  recaptchaToken?: string
}

// No authorizer on this route (see template.yaml's Auth: Authorizer: NONE
// override) -- the requester has no account yet, so this is a plain
// APIGatewayProxyEventV2, not the JWT-authorizer variant every other
// handler in this project uses.
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const body = parseJsonBody<RequestBody>(event.body)
  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const { name, email, connection, recaptchaToken } = body
  if (!name || !email || !connection || !recaptchaToken) {
    return jsonResponse(400, {
      error: 'name, email, connection, and recaptchaToken are all required',
    })
  }

  const secret = await getRecaptchaSecret()
  const result = await verifyRecaptcha(recaptchaToken, secret)
  if (!isVerificationAcceptable(result)) {
    return jsonResponse(400, { error: 'reCAPTCHA verification failed' })
  }

  const userPoolId = requireEnv('COGNITO_USER_POOL_ID')

  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:requester_name', Value: name },
          { Name: 'custom:connection', Value: connection },
        ],
        // Suppress Cognito's own invitation email -- this account has no
        // usable credentials yet (a real, but never-communicated,
        // auto-generated temp password) until an admin actually
        // approves it. adminApproveUser.ts's MessageAction: 'RESEND' is
        // the first time this person ever receives real login
        // credentials, not this call.
        MessageAction: 'SUPPRESS',
      }),
    )
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: GROUPS.PENDING,
      }),
    )
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) {
      throw err
    }
    // Already requested before (or already has an account entirely) --
    // resubmitting shouldn't look like an error to the requester.
    // Deliberately doesn't touch existing group membership: someone
    // who's already approved re-submitting this form must not be
    // silently added back to 'pending'.
  }

  const frontendOrigin = requireEnv('FRONTEND_ORIGIN')

  await sendAdminNotification({ name, email, connection }, frontendOrigin)

  return jsonResponse(200, { ok: true })
}
