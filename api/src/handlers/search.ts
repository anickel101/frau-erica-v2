import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getDb } from '../lib/db'
import { searchPersons } from '../lib/queries/search'
import { jsonResponse } from '../lib/response'

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const query = event.queryStringParameters?.q
  if (!query) {
    return jsonResponse(400, { error: 'Missing q query parameter' })
  }

  const db = await getDb()
  return jsonResponse(200, { results: searchPersons(db, query) })
}
