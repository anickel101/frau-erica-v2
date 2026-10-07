import documentsDetailRaw from '../../data/generated/documents.json'
import imagesRaw from '../../data/generated/images.json'
import { resolveImageUrl } from '../../utils/imageUrl'
import { resolveDocumentPair } from './documents'
import type { DocumentListItem, DocumentLanguage } from './documents'

// Reading one document, kept apart from ./documents on purpose.
//
// documents.json is 1.2 MB -- every published document's full body text
// -- and images.json another 203 KB. Exactly one function needs either:
// getDocumentById, below. While it lived alongside listDocuments, any
// page importing *anything* from that module pulled both files, because
// a static import is not tree-shakeable by what you happen to call.
//
// So the Index of Texts, which needs only the 83 KB list, was shipping
// 1.4 MB of document bodies to render a list of titles -- about four
// seconds at 1 Mbps with nothing on screen yet, for an audience on old
// devices and sometimes bad connections. Worse than the wait: a drop
// mid-transfer looks like a stale chunk, so ErrorBoundary's recovery
// reloads the page and an ordinary hiccup turns into a reload.
//
// The split is the whole fix. Only TextPage imports this module, so only
// TextPage's route chunk carries the bodies, and the index and
// collections pages fall back to the list alone. If you add a function
// here, check first whether it really needs the detail data -- putting a
// list-only helper in this file silently re-creates the problem.

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
