import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireAdminAccess } from '../lib/auth'
import { listAllPhotoTags, listPhotoTagsForGallery } from '../lib/photoTags'
import { galleryIdFromParam } from '../lib/queries/photoTagTargets'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

// The tags in one gallery, or -- with no gallery_id -- all of them.
//
// Per gallery is what makes the work resumable: the page opens, asks
// what is already tagged, and shows the archivist where they stopped
// rather than a wall of photographs with no indication which are done.
// By gallery rather than by image, so opening one costs a single request
// instead of one per photograph.
//
// All of them is what lets the gallery picker show progress across the
// whole archive, and how much is collected but not yet applied to it.
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const raw = event.queryStringParameters?.gallery_id

  // Absent means every gallery. A PRESENT but malformed value is still a
  // 400: silently returning the whole archive because someone typed
  // gallery_id=abc would be a surprising amount of data and a confusing
  // answer to a question that was asked wrongly.
  //
  // galleryIdFromParam rather than a regex here, because a regex here is
  // exactly what went wrong: /^\d+$/ cannot match -1 or -2, so the two
  // synthetic groups could be written to and never read back. The rule
  // now lives next to the constants it has to agree with.
  if (raw === undefined) {
    return jsonResponse(200, { tags: await listAllPhotoTags() })
  }

  const galleryId = galleryIdFromParam(raw)
  if (galleryId === null) {
    return jsonResponse(400, {
      error: 'gallery_id must be a gallery number, or -1 / -2 for the two groups',
    })
  }
  return jsonResponse(200, { tags: await listPhotoTagsForGallery(galleryId) })
}

export const handler = withLogging('listPhotoTags', baseHandler)
