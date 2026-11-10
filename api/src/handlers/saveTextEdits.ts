import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { getCallerEmail, requireAdminAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { log } from '../lib/log'
import { parseJsonBody } from '../lib/parseJsonBody'
import { personExists } from '../lib/queries/photoTagTargets'
import { getEditableText } from '../lib/queries/textEditTargets'
import { jsonResponse } from '../lib/response'
import { planTextEdits } from '../lib/textEditPlan'
import { deleteTextEdit, listTextEditsForDocument, putTextEdit } from '../lib/textEdits'
import { withLogging } from '../lib/withLogging'

function asId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

// Saves proposed changes to one text's catalogue fields.
//
// Admin-only, like every route that writes anything. Writes to the
// TextEdits table and nowhere else; the snapshot is opened read-only, to
// refuse an edit to a text the page should not be editing and an author
// or link naming a person who doesn't exist -- the quiet kind of mistake
// that would otherwise surface only when the edits are applied.
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const documentId = asId(event.pathParameters?.documentId)
  if (documentId === null) {
    return jsonResponse(400, { error: 'documentId must be a positive integer' })
  }

  const body = parseJsonBody<unknown>(event.body)
  if (body === null) return jsonResponse(400, { error: 'Invalid JSON body' })

  const db = await getDb()
  const text = getEditableText(db, documentId)
  if (!text) {
    return jsonResponse(404, { error: `No published text ${documentId}` })
  }

  const plan = planTextEdits(text, body)
  if ('error' in plan) return jsonResponse(400, { error: plan.error })

  const missing = plan.personIds.filter((id) => !personExists(db, id))
  if (missing.length > 0) {
    return jsonResponse(404, { error: `No person ${missing.join(', ')}` })
  }

  const editedBy = getCallerEmail(event) ?? 'unknown'
  const editedAt = new Date().toISOString()
  await Promise.all([
    ...plan.put.map((edit) =>
      putTextEdit({
        document_id: documentId,
        ...edit,
        edited_by: editedBy,
        edited_at: editedAt,
      }),
    ),
    ...plan.clear.map((field) => deleteTextEdit(documentId, field)),
  ])

  log.info('text-edit.saved', {
    documentId,
    proposed: plan.put.map((edit) => edit.field),
    cleared: plan.clear,
    editedBy,
  })

  return jsonResponse(200, { edits: await listTextEditsForDocument(documentId) })
}

export const handler = withLogging('save-text-edits', baseHandler)
