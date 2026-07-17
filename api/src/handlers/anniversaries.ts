import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireApprovedAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { getAnniversaries } from '../lib/queries/anniversaries'
import { jsonResponse } from '../lib/response'

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireApprovedAccess(event)
  if (denied) return denied

  const db = await getDb()
  return jsonResponse(200, { events: getAnniversaries(db) })
}
