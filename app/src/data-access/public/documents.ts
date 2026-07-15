import documentsDetailRaw from '../../data/generated/documents.json'
import documentsListRaw from '../../data/generated/documents-list.json'
import imagesRaw from '../../data/generated/images.json'

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
}

export interface DocumentDetail extends DocumentListItem {
  content: string
}

interface GeneratedImage {
  image_id: number
  caption: string | null
  url: string
}

const documentsList = documentsListRaw as DocumentListItem[]
const documentsDetail = documentsDetailRaw as DocumentDetail[]
const imagesById = new Map(
  (imagesRaw as GeneratedImage[]).map((img) => [img.image_id, img]),
)

// {{image:ID}} placeholders in markdown content reference a real Images
// row and are resolved here, at read time -- not by the export script --
// per schema.sql's own stated intent ("resolved at render time by the
// website, not by the database"). An id with no matching (e.g.
// unpublished) image is stripped rather than left as literal placeholder
// text.
const IMAGE_PLACEHOLDER = /\{\{image:(\d+)\}\}/g

function resolveImagePlaceholders(content: string): string {
  return content.replace(IMAGE_PLACEHOLDER, (_match, idStr: string) => {
    const image = imagesById.get(Number(idStr))
    if (!image) return ''
    return `![${image.caption ?? ''}](${image.url})`
  })
}

export function listDocuments(): DocumentListItem[] {
  return documentsList
}

export function getDocumentById(id: number): DocumentDetail | undefined {
  const document = documentsDetail.find((d) => d.document_id === id)
  if (!document) return undefined
  return { ...document, content: resolveImagePlaceholders(document.content) }
}

export function getSeriesChapters(seriesKey: string): DocumentListItem[] {
  return documentsList
    .filter((d) => d.series_key === seriesKey)
    .sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0))
}
