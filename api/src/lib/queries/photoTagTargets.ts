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

// Deliberately checks the pairing, not just that each id exists: the
// gallery_id is what the by-gallery index is built on, so a tag filed
// under the wrong gallery would be invisible to the page that needs to
// show it -- present in the table, absent from every view of it.
export function imageIsInGallery(
  db: Database,
  imageId: number,
  galleryId: number,
): boolean {
  return (
    queryOne<{ n: number }>(
      db,
      `SELECT count(*) AS n FROM GalleryImages
        WHERE image_id = :image AND gallery_id = :gallery`,
      { ':image': imageId, ':gallery': galleryId },
    )?.n === 1
  )
}
