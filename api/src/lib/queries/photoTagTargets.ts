import type { Database } from 'sql.js'
import { queryOne } from '../sqlHelpers'

// Checks that a proposed tag points at things that actually exist,
// against the read-only archive snapshot.
//
// Worth the cold-start cost of opening the snapshot on a write route,
// because the failure it prevents is the quiet kind. A tag naming a
// person_id that doesn't exist, or an image that isn't in the gallery
// the tagger thought they were in, produces no error anywhere: it sits
// in the table looking like data until someone tries to apply it to
// ImageLinks weeks later, by which time there is no way to work out
// what was meant. Rejecting it at the moment of the click means the
// archivist can simply try again.
//
// These read the same S3 snapshot every other gated route reads, with
// the same read-only IAM grant. Nothing here can write to the archive.

export function personExists(db: Database, personId: number): boolean {
  return (
    queryOne<{ n: number }>(
      db,
      'SELECT count(*) AS n FROM Persons WHERE person_id = :id',
      {
        ':id': personId,
      },
    )?.n === 1
  )
}

// Two synthetic groups, for the 263 published photographs that belong to
// no gallery at all -- 171 header images and 92 others. They are not
// Galleries rows: adding them as real ones would put "Header images" on
// the public Index of Galleries, which is nobody's idea of a gallery.
//
// Negative, so they cannot collide with a real gallery_id now or ever.
// They are stored on the tag like any other gallery id, which is what
// lets the by-gallery index carry them -- the tagging tool resumes and
// counts progress for these groups exactly as it does for real
// galleries, with no special case anywhere but here.
export const HEADER_IMAGES_GROUP = -1
export const MISCELLANEOUS_GROUP = -2

// Checks the PAIRING, not just that each id exists: gallery_id is what
// the by-gallery index is built on, so a tag filed under the wrong
// gallery would be invisible to the page that needs to show it --
// present in the table, absent from every view of it.
export function imageIsInGallery(
  db: Database,
  imageId: number,
  galleryId: number,
): boolean {
  if (galleryId === HEADER_IMAGES_GROUP || galleryId === MISCELLANEOUS_GROUP) {
    // A header image is one whose filename begins "hdr." -- the
    // archive's own long-standing convention, the same one the export
    // relies on to find a page's header photograph. Miscellaneous is
    // everything else outside a gallery.
    const header = galleryId === HEADER_IMAGES_GROUP
    return (
      queryOne<{ n: number }>(
        db,
        `SELECT count(*) AS n FROM Images
          WHERE image_id = :image
            AND is_published = 1
            AND url ${header ? 'LIKE' : 'NOT LIKE'} 'hdr%'
            AND image_id NOT IN (SELECT image_id FROM GalleryImages)`,
        { ':image': imageId },
      )?.n === 1
    )
  }

  return (
    queryOne<{ n: number }>(
      db,
      `SELECT count(*) AS n FROM GalleryImages
        WHERE image_id = :image AND gallery_id = :gallery`,
      { ':image': imageId, ':gallery': galleryId },
    )?.n === 1
  )
}
