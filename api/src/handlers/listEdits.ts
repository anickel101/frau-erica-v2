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

  // GET /edits?type=document&hidden=1: the hidden records of a kind that
  // can be hidden, and that kind's pending edits (a republish waiting).
  if (event.queryStringParameters?.hidden === '1') {
    if (!editType.listHidden) {
      return jsonResponse(400, { error: `A ${type} can't be hidden` })
    }
    const db = await getDb()
    return jsonResponse(200, {
      targets: editType.listHidden(db),
      edits: await listEditsOfType(type),
    })
  }

  const idParam = event.queryStringParameters?.id
  if (idParam !== undefined) {
    const id = editType.parseId(idParam)
    if (id === null) return jsonResponse(400, { error: `Not a ${type} id` })
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
