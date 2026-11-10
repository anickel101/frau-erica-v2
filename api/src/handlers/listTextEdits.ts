import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireAdminAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { listEditableTexts } from '../lib/queries/textEditTargets'
import { jsonResponse } from '../lib/response'
import { listAllTextEdits } from '../lib/textEdits'
import { withLogging } from '../lib/withLogging'

// Every published text as the archive has it, and every edit pending
// against them -- everything the text-tagging page needs, in one request.
//
// The archive's values come from the snapshot rather than the committed
// export, because the snapshot is what an edit is checked against when
// it is saved, and the page should show the same "before" that the save
// will record.
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const db = await getDb()
  const texts = listEditableTexts(db)
  const edits = await listAllTextEdits()
  return jsonResponse(200, { texts, edits })
}

export const handler = withLogging('list-text-edits', baseHandler)
