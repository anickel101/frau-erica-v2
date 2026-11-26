import imagesRaw from '../../data/generated/images.json'
import type { ImageDimensions } from '../../utils/documentImageLayout'
import { resolveImageUrl } from '../../utils/imageUrl'

// The photographs a text can show, and turning a text's {{image:ID}}
// placeholders into the markdown images the page renders.
//
// Its own module, importing images.json (203 KB) alone, so the admin text
// editor can preview a draft without also loading every text's body
// (documents.json, 1.2 MB) through documentDetail.ts, which re-exports
// these for the text page.

export interface DocumentImage {
  image_id: number
  title: string | null
  caption: string | null
  url: string
  width: number | null
  height: number | null
}

const images = imagesRaw as DocumentImage[]
const imagesById = new Map(images.map((img) => [img.image_id, img]))

// Every published photograph, for the editor's Insert photo picker.
export function listDocumentImages(): DocumentImage[] {
  return images
}

export function getDocumentImage(id: number): DocumentImage | undefined {
  return imagesById.get(id)
}

const IMAGE_PLACEHOLDER = /\{\{image:(\d+)(?::(\w+))?\}\}/g

export function resolveImagePlaceholders(content: string): string {
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

// A photograph's number from the address a text's placeholder resolved
// to: a text's markdown carries only the address by the time it renders,
// and an admin looking at the photo wants its number.
const idBySrc = new Map(images.map((img) => [resolveImageUrl(img.url), img.image_id]))

export function getImageIdBySrc(src: string): number | undefined {
  return idBySrc.get(src)
}

const dimensionsBySrc = new Map(
  images.flatMap((img) =>
    img.width && img.height
      ? [[resolveImageUrl(img.url), { width: img.width, height: img.height }] as const]
      : [],
  ),
)

export function getImageDimensions(src: string): ImageDimensions | undefined {
  return dimensionsBySrc.get(src)
}
