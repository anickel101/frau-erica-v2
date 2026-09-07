import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireApprovedAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { searchPersons } from '../lib/queries/search'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireApprovedAccess(event)
  if (denied) return denied

  const query = event.queryStringParameters?.q
  if (!query) {
    return jsonResponse(400, { error: 'Missing q query parameter' })
  }

  // Trimmed length, not raw. `?q=%20` passed the truthiness check above,
  // then searchPersons trimmed it to an empty needle -- and every name
  // contains the empty string, so a single space returned all ~1,300
  // people in one response. Approved users only, so this was a payload
  // problem rather than a leak, but it's also not a search anyone meant
  // to run.
  //
  // Two characters rather than one: a single letter matches a large
  // fraction of the archive anyway, and the search box fires per
  // keystroke.
  const needle = query.trim()
  if (needle.length < 2) {
    return jsonResponse(400, { error: 'Please enter at least two characters to search' })
  }

  const db = await getDb()
  return jsonResponse(200, { results: searchPersons(db, needle) })
}

export const handler = withLogging('search', baseHandler)
