import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireAdminAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { EDIT_TYPES } from '../lib/editTypes'
import { entityKey, listEditsForEntity, listEditsOfType } from '../lib/edits'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

// GET /edits?type=document: every record of that type as the archive has
// it, and every edit pending against them -- drafts and submitted alike --
// in one request.
//
// GET /edits?type=document&id=40: that one record in full (a text with
// its body, which the list leaves out) and its own pending edits. What
// the text editor opens with.
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

  const idParam = event.queryStringParameters?.id
  if (idParam !== undefined) {
    const id = /^\d+$/.test(idParam) ? Number(idParam) : NaN
    if (!Number.isSafeInteger(id) || id <= 0) {
      return jsonResponse(400, { error: 'id must be a positive integer' })
    }
    const db = await getDb()
    const target = editType.get(db, id)
    if (!target) return jsonResponse(404, { error: `No editable ${type} ${id}` })
    return jsonResponse(200, {
      targets: [target],
      edits: await listEditsForEntity(entityKey(type, id)),
    })
  }

  const db = await getDb()
  const [targets, edits] = [editType.list(db), await listEditsOfType(type)]
  return jsonResponse(200, { targets, edits })
}

export const handler = withLogging('list-edits', baseHandler)
