import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { getCallerEmail, requireAdminAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { log } from '../lib/log'
import { parseJsonBody } from '../lib/parseJsonBody'
import { putPhotoTag } from '../lib/photoTags'
import { imageIsInGallery, personExists } from '../lib/queries/photoTagTargets'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

interface AddTagBody {
  image_id?: unknown
  person_id?: unknown
  gallery_id?: unknown
}

// A positive integer, and genuinely an integer -- JSON will happily
// carry 12.5 or "12" or 1e9 into a field typed number, and all three
// would reach DynamoDB as a key that no later query would ever match.
function asId(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return null
  return value
}

// Records that a person appears in a photograph.
//
// Admin-only, like every route that writes anything. Hiding the tagging
// page behind RequireAdmin in the browser is a convenience for the
// admin, not a control -- this check is the control.
//
// Writes to the PhotoTags table and nowhere else. The archive snapshot
// is opened read-only, purely to validate the ids before accepting them
// (see queries/photoTagTargets.ts for why that is worth a cold start).
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const body = parseJsonBody<AddTagBody>(event.body)
  if (!body) return jsonResponse(400, { error: 'Invalid JSON body' })

  const imageId = asId(body.image_id)
  const personId = asId(body.person_id)
  const galleryId = asId(body.gallery_id)
  if (imageId === null || personId === null || galleryId === null) {
    return jsonResponse(400, {
      error: 'image_id, person_id and gallery_id must each be a positive integer',
    })
  }

  const db = await getDb()
  if (!personExists(db, personId)) {
    return jsonResponse(404, { error: `No person ${personId}` })
  }
  if (!imageIsInGallery(db, imageId, galleryId)) {
    return jsonResponse(404, { error: `Image ${imageId} is not in gallery ${galleryId}` })
  }

  const taggedBy = getCallerEmail(event) ?? 'unknown'
  await putPhotoTag({
    image_id: imageId,
    person_id: personId,
    gallery_id: galleryId,
    tagged_by: taggedBy,
    tagged_at: new Date().toISOString(),
  })

  log.info('photo-tag.added', { imageId, personId, galleryId, taggedBy })

  // 200, not 201: the (image, person) pair is the key, so re-tagging
  // someone already tagged overwrites rather than creating, and the
  // archivist tapping a name twice should see success rather than an
  // error about something they did not do wrong.
  return jsonResponse(200, { image_id: imageId, person_id: personId })
}

export const handler = withLogging('addPhotoTag', baseHandler)
