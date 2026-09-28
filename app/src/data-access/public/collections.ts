import collectionsRaw from '../../data/generated/collections.json'
import { resolveImageUrl } from '../../utils/imageUrl'

// A collection is a named group of texts -- the thing Documents.series_key
// has always grouped without ever saying what it was. See schema.sql's
// note under Series.
//
// Three kinds, because three genuinely different things were all being
// called "a series" and reading identically in the index:
//
//   work    one work in several chapters, read in order -- a memoir, a
//           travel journal, a translated booklet.
//   annual  the same thing once a year. Twenty-eight Christmas letters
//           between 1995 and 2023 are not chapters; they are a run.
//   person  everything the archive holds about one person, written by
//           different hands at different times, with no reading order.
export type CollectionKind = 'work' | 'annual' | 'person'

export interface Collection {
  series_key: string
  // What the URL says: /collections/christmas-letters. Kept separate
  // from series_key, which is internal CamelCase.
  slug: string
  name: string
  kind: CollectionKind
  blurb: string | null
  // Never null in practice: the export falls back to the first
  // chapter's header image, and every document has one. Typed nullable
  // because nothing guarantees that stays true.
  cover_image_url: string | null
  // Published chapters only, counted at export.
  chapterCount: number
}

const collections = (collectionsRaw as Collection[]).map((collection) => ({
  ...collection,
  cover_image_url: collection.cover_image_url
    ? resolveImageUrl(collection.cover_image_url)
    : null,
}))

const byKey = new Map(collections.map((c) => [c.series_key, c]))
const bySlug = new Map(collections.map((c) => [c.slug, c]))

// How many published texts a group needs before it is shown as a
// collection rather than as ordinary texts.
//
// A card reading "1 text" is a worse answer than just listing that text:
// it promises a collection and delivers a single document one click
// further away. Four groups are in that position today -- each has one
// published text and one or more still unpublished -- and each becomes a
// collection on its own the moment a second is published, with no code
// change.
export const MINIMUM_COLLECTION_SIZE = 2

export function listCollections(): Collection[] {
  return collections.filter((c) => c.chapterCount >= MINIMUM_COLLECTION_SIZE)
}

// Looks up by key regardless of size, so callers that already hold a
// document's series_key can find its collection even when that group is
// too small to appear on the shelf.
export function getCollectionByKey(seriesKey: string): Collection | undefined {
  return byKey.get(seriesKey)
}

export function getCollectionBySlug(slug: string): Collection | undefined {
  return bySlug.get(slug)
}
