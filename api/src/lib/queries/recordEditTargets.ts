import type { Database } from 'sql.js'
import { queryAll } from '../sqlHelpers'

// What the archive currently says about the photographs, galleries and
// collections an admin can edit, read from the snapshot: the "before"
// the editing pages show and each save records.

// A published photograph. An unpublished one isn't on the site to be
// found and edited; bringing one back is a separate step.
export interface EditableImage {
  image_id: number
  url: string
  title: string | null
  caption: string | null
  credit: string | null
  year_taken: number | null
  location: string | null
}

const IMAGE_COLUMNS = 'image_id, url, title, caption, credit, year_taken, location'

export function listEditableImages(db: Database): EditableImage[] {
  return queryAll<EditableImage>(
    db,
    `SELECT ${IMAGE_COLUMNS} FROM Images WHERE is_published = 1 ORDER BY image_id`,
  )
}

export function getEditableImage(db: Database, imageId: number): EditableImage | null {
  const rows = queryAll<EditableImage>(
    db,
    `SELECT ${IMAGE_COLUMNS} FROM Images WHERE image_id = :id AND is_published = 1`,
    { ':id': imageId },
  )
  return rows[0] ?? null
}

export interface EditableGallery {
  gallery_id: number
  name: string
  summary: string | null
}

export function listEditableGalleries(db: Database): EditableGallery[] {
  return queryAll<EditableGallery>(
    db,
    'SELECT gallery_id, name, summary FROM Galleries ORDER BY gallery_id',
  )
}

export function getEditableGallery(
  db: Database,
  galleryId: number,
): EditableGallery | null {
  const rows = queryAll<EditableGallery>(
    db,
    'SELECT gallery_id, name, summary FROM Galleries WHERE gallery_id = :id',
    { ':id': galleryId },
  )
  return rows[0] ?? null
}

// A collection: a row of Series, keyed by its series_key ("FredKnief"),
// not a number.
export interface EditableSeries {
  series_key: string
  slug: string
  name: string
  blurb: string | null
}

export function listEditableSeries(db: Database): EditableSeries[] {
  return queryAll<EditableSeries>(
    db,
    'SELECT series_key, slug, name, blurb FROM Series ORDER BY name',
  )
}

export function getEditableSeries(
  db: Database,
  seriesKey: string,
): EditableSeries | null {
  const rows = queryAll<EditableSeries>(
    db,
    'SELECT series_key, slug, name, blurb FROM Series WHERE series_key = :key',
    { ':key': seriesKey },
  )
  return rows[0] ?? null
}
