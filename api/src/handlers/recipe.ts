import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireApprovedAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { getRecipeBySlug } from '../lib/queries/recipes'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

// GET /recipes/{slug} -- one recipe with its sections, ingredients and
// steps. Keyed by slug rather than id because the slug is the URL
// identity the frontend already holds from the index, and it survives a
// reimport (which reassigns recipe_id).
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireApprovedAccess(event)
  if (denied) return denied

  const slug = event.pathParameters?.slug
  if (!slug) {
    return jsonResponse(400, { error: 'Missing slug path parameter' })
  }

  const db = await getDb()
  const recipe = getRecipeBySlug(db, slug)
  // Also the answer for an unpublished recipe: getRecipeBySlug filters
  // on is_published, so guessing the slug of one of the four hidden
  // recipes returns 404 rather than revealing it exists.
  if (!recipe) {
    return jsonResponse(404, { error: `No recipe with slug ${slug}` })
  }

  return jsonResponse(200, recipe)
}

export const handler = withLogging('recipe', baseHandler)
