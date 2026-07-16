import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { jsonResponse } from '../lib/response'

// No database access needed -- this route only echoes back what the
// Cognito JWT authorizer already validated and attached to the request.
// Exists to prove identity/claims wiring (e.g. custom:person_id) in
// isolation, independent of the query layer.
export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const claims = event.requestContext.authorizer.jwt.claims
  const personIdClaim = claims['custom:person_id']

  return jsonResponse(200, {
    sub: claims.sub,
    email: claims.email ?? null,
    groups: claims['cognito:groups'] ?? null,
    personId: typeof personIdClaim === 'string' ? Number(personIdClaim) : null,
  })
}
