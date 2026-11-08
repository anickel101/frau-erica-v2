import { resolveImageUrl } from '../../utils/imageUrl'

// What the archive connects to each person -- the content of the Family
// page's "More info" pop-up. The rules live with the export
// (scripts/export-data.ts, "Person links"); this only reads the result.
//
// Loaded on demand, not imported: it is ~110 KB, only Family pages and
// the per-person photo page want it, and a static import would put it in
// whichever chunk imports this module. See documentDetail.ts for what
// that mistake cost the Index of Texts.

export interface LinkedPhoto {
  image_id: number
  src: string
  caption: string
  width: number | null
  height: number | null
}

export interface LinkedText {
  document_id: number
  title: string
}

export interface LinkedGallery {
  gallery_id: number
  name: string
  leadSrc: string | null
}

export interface LinkedCollection {
  slug: string
  name: string
}

export interface PersonLinks {
  photos: LinkedPhoto[]
  writings: LinkedText[]
  texts: LinkedText[]
  galleries: LinkedGallery[]
  collections: LinkedCollection[]
}

interface Generated {
  people: Record<
    string,
    {
      photos: number[]
      writings: number[]
      texts: number[]
      galleries: number[]
      collections: string[]
    }
  >
  photos: Record<
    string,
    { url: string; caption: string; width: number | null; height: number | null }
  >
  texts: Record<string, { title: string }>
  galleries: Record<string, { name: string; lead_url: string | null }>
  collections: Record<string, { name: string; slug: string }>
}

export type PersonLinksIndex = (personId: number) => PersonLinks | null

let loading: Promise<PersonLinksIndex> | null = null

export function loadPersonLinks(): Promise<PersonLinksIndex> {
  loading ??= import('../../data/generated/person-links.json').then(({ default: raw }) =>
    indexFrom(raw as unknown as Generated),
  )
  return loading
}

function indexFrom(data: Generated): PersonLinksIndex {
  const text = (id: number): LinkedText => ({ document_id: id, ...data.texts[id] })
  return (personId) => {
    const entry = data.people[personId]
    if (!entry) return null
    return {
      photos: entry.photos.map((id) => {
        const photo = data.photos[id]
        return {
          image_id: id,
          src: resolveImageUrl(photo.url),
          caption: photo.caption,
          width: photo.width,
          height: photo.height,
        }
      }),
      writings: entry.writings.map(text),
      texts: entry.texts.map(text),
      galleries: entry.galleries.map((id) => {
        const gallery = data.galleries[id]
        return {
          gallery_id: id,
          name: gallery.name,
          leadSrc: gallery.lead_url ? resolveImageUrl(gallery.lead_url) : null,
        }
      }),
      collections: entry.collections.map((key) => data.collections[key]),
    }
  }
}
