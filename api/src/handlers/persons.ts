import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getDb } from '../lib/db'
import { getPersonById } from '../lib/queries/persons'
import { jsonResponse } from '../lib/response'

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const id = Number(event.pathParameters?.id)
  if (!Number.isInteger(id)) {
    return jsonResponse(400, { error: 'Missing or invalid id path parameter' })
  }

  const db = await getDb()
  const person = getPersonById(db, id)
  if (!person) {
    return jsonResponse(404, { error: `No person with id ${id}` })
  }

  return jsonResponse(200, person)
}
