import documentsDetailRaw from '../../data/generated/documents.json'
import documentsListRaw from '../../data/generated/documents-list.json'
import imagesRaw from '../../data/generated/images.json'
import { resolveImageUrl } from '../../utils/imageUrl'

export type DocumentLanguage = 'en' | 'de'

export interface DocumentListItem {
  document_id: number
  series_key: string | null
  series_title: string | null
  series_order: number | null
  title: string
  author: string | null
  authorPersonId: number | null
  summary: string | null
  genre:
    'Biography' | 'Memoir' | 'History' | 'Literary' | 'Letter' | 'Recipe' | 'Other' | null
  tags: string | null
  // Which language this document's own content is in, for the handful
  // of works the archive holds in both. null for everything else, which
  // is most of it -- see schema.sql's note under Documents.
  language: DocumentLanguage | null
}

// The other half of a parallel text, already resolved -- so a caller
// never has to know that a pair is two rows, or which of the two the
// reader happened to ask for.
export interface ParallelHalf {
  document_id: number
  language: DocumentLanguage
  content: string
}

export interface DocumentDetail extends DocumentListItem {
  content: string
  // The counterpart, where this work exists in both languages. The
  // German and English halves of a pair always arrive as
  // document/parallel with the entry point as `document`, whichever of
  // the two ids was asked for.
  parallel: ParallelHalf | null
  // Resolved at export time (see scripts/export-data.ts): the document's
  // own "hdr."-prefixed linked image where it has one, otherwise the
  // archive-wide default. Never null in practice, but typed nullable
  // because nothing in the schema guarantees the default image stays
  // published.
  header_image_url: string | null
  header_image_caption: string | null
}

interface GeneratedImage {
  image_id: number
  caption: string | null
  url: string
}

// The shape actually stored in documents.json: parallel_of is a raw id,
// which getDocumentById resolves into a ParallelHalf before any caller
// sees it.
interface GeneratedDocument extends DocumentListItem {
  content: string
  parallel_of: number | null
  header_image_url: string | null
  header_image_caption: string | null
}

const documentsList = documentsListRaw as DocumentListItem[]
const documentsDetail = documentsDetailRaw as GeneratedDocument[]
const imagesById = new Map(
  (imagesRaw as GeneratedImage[]).map((img) => [img.image_id, img]),
)

// {{image:ID}} placeholders in markdown content reference a real Images
// row and are resolved here, at read time -- not by the export script --
// per schema.sql's own stated intent ("resolved at render time by the
// website, not by the database"). An id with no matching (e.g.
// unpublished) image is stripped rather than left as literal placeholder
// text.
//
// An optional `:modifier` suffix -- {{image:ID:wide}} or {{image:ID:300}}
// -- carries display intent past markdown's own image syntax by riding
// along in the (otherwise-unused, by every image in this app) markdown
// title slot: `![caption](url "modifier")`. TextPage.tsx's img renderer
// reads that title back out to pick a full-width, non-floated treatment
// ("wide") or an explicit pixel width overriding the default rotation
// (a bare number), instead of the usual floated/rotating-width image.
const IMAGE_PLACEHOLDER = /\{\{image:(\d+)(?::(\w+))?\}\}/g

function resolveImagePlaceholders(content: string): string {
  return content.replace(
    IMAGE_PLACEHOLDER,
    (_match, idStr: string, modifier: string | undefined) => {
      const image = imagesById.get(Number(idStr))
      if (!image) return ''
      const caption = image.caption ?? ''
      const url = resolveImageUrl(image.url)
      return modifier ? `![${caption}](${url} "${modifier}")` : `![${caption}](${url})`
    },
  )
}

export function listDocuments(): DocumentListItem[] {
  return documentsList
}

// Both halves of a parallel text resolve to the same page: ask for
// either id and you get the entry point -- the row carrying the title
// and summary the archive lists -- with its counterpart alongside. A
// reader who lands on the German half's URL gets the pair rather than
// an untitled German page with no way back.
//
// Exported and generic over the row shape so it can be tested directly:
// no document in the archive is split yet, so there is no real fixture
// to assert against, and the alternative would be mocking the generated
// JSON module.
export function resolveDocumentPair<
  T extends { document_id: number; parallel_of: number | null },
>(all: T[], id: number): { entry: T; counterpart: T | undefined } | undefined {
  const asked = all.find((d) => d.document_id === id)
  if (!asked) return undefined

  // If the id names a translated half, the entry point is what it
  // points at; otherwise it IS the entry point, and its counterpart is
  // whatever points back at it. The ?? asked fallback covers a
  // dangling pointer -- better a lone German page than none at all.
  const entry =
    asked.parallel_of !== null
      ? (all.find((d) => d.document_id === asked.parallel_of) ?? asked)
      : asked
  const counterpart =
    entry === asked ? all.find((d) => d.parallel_of === entry.document_id) : asked

  return { entry, counterpart }
}

export function getDocumentById(id: number): DocumentDetail | undefined {
  const resolved = resolveDocumentPair(documentsDetail, id)
  if (!resolved) return undefined
  const { entry, counterpart } = resolved

  // parallel_of is the stored pointer; callers get the resolved
  // `parallel` below instead, so it does not belong in the public shape.
  const rest = { ...entry, parallel_of: undefined }
  delete (rest as { parallel_of?: number }).parallel_of
  return {
    ...rest,
    content: resolveImagePlaceholders(entry.content),
    parallel:
      counterpart && counterpart.language !== null
        ? {
            document_id: counterpart.document_id,
            language: counterpart.language,
            content: resolveImagePlaceholders(counterpart.content),
          }
        : null,
  }
}

export function getSeriesChapters(seriesKey: string): DocumentListItem[] {
  return documentsList
    .filter((d) => d.series_key === seriesKey)
    .sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0))
}
