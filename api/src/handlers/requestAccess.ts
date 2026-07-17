import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { requireEnv } from '../lib/env'
import { parseJsonBody } from '../lib/parseJsonBody'
import { isVerificationAcceptable, verifyRecaptcha } from '../lib/recaptcha'
import { jsonResponse } from '../lib/response'
import { getRecaptchaSecret } from '../lib/secrets'
import { sendAdminNotification } from '../lib/ses'

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

  const frontendOrigin = requireEnv('FRONTEND_ORIGIN')

  await sendAdminNotification({ name, email, connection }, frontendOrigin)

  return jsonResponse(200, { ok: true })
}
