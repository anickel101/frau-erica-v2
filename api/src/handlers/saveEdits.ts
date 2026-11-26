import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { getCallerEmail, requireAdminAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { EDIT_TYPES } from '../lib/editTypes'
import {
  EDIT_STATUSES,
  deleteEdit,
  entityKey,
  listEditsForEntity,
  putEdit,
  type EditStatus,
} from '../lib/edits'
import { log } from '../lib/log'
import { parseJsonBody } from '../lib/parseJsonBody'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

// Saves proposed changes to one record: POST /edits/{type}/{id} with
// { changes, status }. status is 'draft' (work in progress, never
// applied) or 'submitted' (ready for the review script), defaulting to
// submitted -- what the tagging pages have always meant by saving.
//
// Admin-only, like every route that writes anything. Writes to the Edits
// table and nowhere else.
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const type = event.pathParameters?.type ?? ''
  const editType = Object.hasOwn(EDIT_TYPES, type) ? EDIT_TYPES[type] : undefined
  if (!editType) return jsonResponse(404, { error: `Unknown record type "${type}"` })

  const id = editType.parseId(event.pathParameters?.id ?? '')
  if (id === null) return jsonResponse(400, { error: `Not a ${type} id` })

  const body = parseJsonBody<{ changes?: unknown; status?: unknown }>(event.body)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(400, { error: 'Expected { changes, status }' })
  }
  const status = (body.status ?? 'submitted') as EditStatus
  if (!(EDIT_STATUSES as readonly unknown[]).includes(status)) {
    return jsonResponse(400, { error: `status must be ${EDIT_STATUSES.join(' or ')}` })
  }

  const db = await getDb()
  const plan = editType.plan(db, id, body.changes, status)
  if ('error' in plan) return jsonResponse(plan.status, { error: plan.error })

  const entity = entityKey(type, id)
  const editedBy = getCallerEmail(event) ?? 'unknown'
  const editedAt = new Date().toISOString()
  await Promise.all([
    ...plan.put.map((edit) =>
      putEdit({ entity, ...edit, status, edited_by: editedBy, edited_at: editedAt }),
    ),
    ...plan.clear.map((field) => deleteEdit(entity, field)),
  ])

  log.info('edit.saved', {
    entity,
    status,
    proposed: plan.put.map((edit) => edit.field),
    cleared: plan.clear,
    editedBy,
  })

  return jsonResponse(200, { edits: await listEditsForEntity(entity) })
}

export const handler = withLogging('save-edits', baseHandler)
