import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireAdminAccess } from '../lib/auth'
import { listPhotoTagsForGallery } from '../lib/photoTags'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

// Every tag in one gallery.
//
// This is what makes the work resumable: the page opens, asks what is
// already tagged, and shows the archivist where they stopped rather than
// a wall of photographs with no indication which have been done. For
// someone working through 337 photographs across weeks, that is the
// difference between a task and a chore.
//
// By gallery rather than by image, so opening a gallery costs one
// request instead of one per photograph.
async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const raw = event.queryStringParameters?.gallery_id
  if (!raw || !/^\d+$/.test(raw)) {
    return jsonResponse(400, { error: 'gallery_id query parameter is required' })
  }

  const tags = await listPhotoTagsForGallery(Number(raw))
  return jsonResponse(200, { tags })
}

export const handler = withLogging('listPhotoTags', baseHandler)
