import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { getCallerEmail, requireAdminAccess } from '../lib/auth'
import { log } from '../lib/log'
import { deletePhotoTag } from '../lib/photoTags'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

function asId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

// Removes a tag -- the undo for a mis-tap.
//
// Deliberately unconditional: deleting a tag that isn't there succeeds
// quietly rather than 404ing. The caller's intent ("this person is not
// in this photograph") is satisfied either way, and an error on a
// double-tap would be noise about a non-problem.
//
// No snapshot read here, so this function has no access to the archive
// at all -- there is nothing to validate against, since removing a tag
// for an id that never existed is already a no-op.
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const imageId = asId(event.pathParameters?.imageId)
  const personId = asId(event.pathParameters?.personId)
  if (imageId === null || personId === null) {
    return jsonResponse(400, { error: 'imageId and personId must be positive integers' })
  }

  await deletePhotoTag(imageId, personId)
  log.info('photo-tag.removed', {
    imageId,
    personId,
    removedBy: getCallerEmail(event) ?? 'unknown',
  })

  return jsonResponse(200, { image_id: imageId, person_id: personId })
}

export const handler = withLogging('deletePhotoTag', baseHandler)
