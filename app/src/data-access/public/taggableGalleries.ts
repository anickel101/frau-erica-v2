import imagesRaw from '../../data/generated/images.json'
import { listGalleries } from './galleries'
import type { GalleryData, GalleryPhoto } from './galleries'
import { resolveImageUrl } from '../../utils/imageUrl'

// Everything the tagging tool can work through: the real galleries, plus
// two synthetic groups covering the photographs that belong to none.
//
// 263 published photographs sit outside any gallery -- 171 header images
// and 92 others -- and until these existed they were simply unreachable.
// Among them are genuinely people-bearing pictures: the couple's own
// gravestones that head one family page, and the document illustrations
// ("Michael, Wilhelmina, and the infant Albert Nickel arrived...").
//
// NOT real Galleries rows. Adding them to the database would put
// "Header images" on the public Index of Galleries, which is nobody's
// idea of a gallery. They exist only here and in the id the tag is
// stored against -- see api/src/lib/queries/photoTagTargets.ts, which
// validates membership the same way this file computes it.
export const HEADER_IMAGES_GROUP = -1
export const MISCELLANEOUS_GROUP = -2

// The URL says "headers" and "misc" rather than -1 and -2: these links
// get bookmarked, and a negative number in a path reads like a bug.
export const GROUP_SLUGS: Record<string, number> = {
  headers: HEADER_IMAGES_GROUP,
  misc: MISCELLANEOUS_GROUP,
}

export function groupSlugFor(galleryId: number): string {
  if (galleryId === HEADER_IMAGES_GROUP) return 'headers'
  if (galleryId === MISCELLANEOUS_GROUP) return 'misc'
  return String(galleryId)
}

// images.json keeps the database's nulls where galleries.json
// normalises them away, so these are coerced rather than cast -- the
// tagging page only reads url, caption and image_id, but GalleryPhoto
// promises the rest are present.
interface RawImage {
  image_id: number
  title: string | null
  caption: string | null
  credit: string | null
  year_taken: number | null
  location: string | null
  width: number | null
  height: number | null
  url: string
  personIds: number[]
}

function toPhoto(img: RawImage): GalleryPhoto {
  return {
    image_id: img.image_id,
    title: img.title ?? '',
    caption: img.caption ?? '',
    credit: img.credit ?? '',
    year_taken: img.year_taken,
    location: img.location ?? '',
    width: img.width ?? 0,
    height: img.height ?? 0,
    url: resolveImageUrl(img.url),
    personIds: img.personIds,
  }
}

// A header image is one whose filename begins "hdr." -- the archive's
// own long-standing convention, and the same rule the export uses to
// find a page's header photograph.
function isHeader(url: string): boolean {
  return url.startsWith('hdr')
}

function synthesise(id: number, name: string, photos: GalleryPhoto[]): GalleryData {
  return {
    gallery_id: id,
    name,
    summary: '',
    lead_image_id: photos[0]?.image_id ?? 0,
    photos,
    // No gallery-level people: nobody's gallery, so the only suggestions
    // these get are the ones earned from captions and from whoever has
    // already been tagged in the group.
    linkedPersonIds: [],
  }
}

export function listTaggableGalleries(): GalleryData[] {
  const inAGallery = new Set(
    listGalleries().flatMap((g) => g.photos.map((p) => p.image_id)),
  )

  // Filename checked before the URL is resolved -- afterwards it carries
  // a CloudFront host in front of it.
  const outside = (imagesRaw as RawImage[]).filter((img) => !inAGallery.has(img.image_id))

  const headers = outside.filter((img) => isHeader(img.url)).map(toPhoto)
  const misc = outside.filter((img) => !isHeader(img.url)).map(toPhoto)

  return [
    ...listGalleries(),
    ...(headers.length > 0
      ? [synthesise(HEADER_IMAGES_GROUP, 'Header images', headers)]
      : []),
    ...(misc.length > 0
      ? [synthesise(MISCELLANEOUS_GROUP, 'Miscellaneous photographs', misc)]
      : []),
  ]
}

export function getTaggableGallery(id: number): GalleryData | undefined {
  return listTaggableGalleries().find((g) => g.gallery_id === id)
}
