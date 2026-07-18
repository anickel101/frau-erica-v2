import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { getPersonIdClaim, requireApprovedAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { getFurthestAncestor, getGermlineIds } from '../lib/queries/germline'
import { jsonResponse } from '../lib/response'

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireApprovedAccess(event)
  if (denied) return denied

  const personId = getPersonIdClaim(event)
  if (personId === null) {
    return jsonResponse(200, { personIds: [], furthestAncestor: null })
  }

  const db = await getDb()
  return jsonResponse(200, {
    personIds: getGermlineIds(db, personId),
    furthestAncestor: getFurthestAncestor(db, personId),
  })
}
