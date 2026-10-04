import { apiFetch } from './apiClient'

// Who appears in which photograph.
//
// These live in their own store, not in the archive -- see
// api/CLAUDE.md's "Photo tagging" section for why. Nothing here can
// alter family data; the tags are applied to the archive's ImageLinks
// later, in a reviewed batch.
export interface PhotoTag {
  image_id: number
  person_id: number
  gallery_id: number
  tagged_by: string
  tagged_at: string
}

export async function listPhotoTags(galleryId: number): Promise<PhotoTag[]> {
  const { tags } = await apiFetch<{ tags: PhotoTag[] }>(
    `/photo-tags?gallery_id=${galleryId}`,
  )
  return tags
}

export function addPhotoTag(
  imageId: number,
  personId: number,
  galleryId: number,
): Promise<unknown> {
  return apiFetch('/photo-tags', {
    method: 'POST',
    body: { image_id: imageId, person_id: personId, gallery_id: galleryId },
  })
}

export function removePhotoTag(imageId: number, personId: number): Promise<unknown> {
  return apiFetch(`/photo-tags/${imageId}/${personId}`, { method: 'DELETE' })
}
