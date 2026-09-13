import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireApprovedAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { listRecipes } from '../lib/queries/recipes'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

// GET /recipes -- the Keepers index. Titles, genres and summaries only;
// no ingredients or steps, which is what keeps this a single small
// payload the frontend can search and filter client-side without a
// round trip per keystroke.
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireApprovedAccess(event)
  if (denied) return denied

  const db = await getDb()
  return jsonResponse(200, { recipes: listRecipes(db) })
}

export const handler = withLogging('recipes', baseHandler)
