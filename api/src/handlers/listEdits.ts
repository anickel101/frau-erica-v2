import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireAdminAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { EDIT_TYPES } from '../lib/editTypes'
import { listEditsOfType } from '../lib/edits'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

// GET /edits?type=document: every record of that type as the archive has
// it, and every edit pending against them -- drafts and submitted alike --
// in one request.
//
// The archive's values come from the snapshot rather than the committed
// export, because the snapshot is what an edit is checked against when it
// is saved, and the page should show the same "before" the save records.
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const type = event.queryStringParameters?.type ?? ''
  const editType = Object.hasOwn(EDIT_TYPES, type) ? EDIT_TYPES[type] : undefined
  if (!editType) return jsonResponse(400, { error: `Unknown record type "${type}"` })

  const db = await getDb()
  const [targets, edits] = [editType.list(db), await listEditsOfType(type)]
  return jsonResponse(200, { targets, edits })
}

export const handler = withLogging('list-edits', baseHandler)
