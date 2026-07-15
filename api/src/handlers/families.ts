import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getDb } from '../lib/db'
import { getFamilyById } from '../lib/queries/families'
import { jsonResponse } from '../lib/response'

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const id = Number(event.pathParameters?.id)
  if (!Number.isInteger(id)) {
    return jsonResponse(400, { error: 'Missing or invalid id path parameter' })
  }

  const db = await getDb()
  const family = getFamilyById(db, id)
  if (!family) {
    return jsonResponse(404, { error: `No family with id ${id}` })
  }

  return jsonResponse(200, family)
}
