// How a document's embedded images are laid out: pure decisions over the
// resolved markdown (by the time content reaches here, {{image:ID}}
// shortcodes are already ![caption](url) or ![caption](url "modifier"),
// see data-access/public/documentDetail.ts). TextPage renders what these
// functions decide; nothing here touches React.

export interface ImageDimensions {
  width: number
  height: number
}

export interface MarkdownImage {
  alt: string
  src: string
  modifier: string | undefined
}

export type ContentSegment =
  { kind: 'markdown'; text: string } | { kind: 'strip'; images: MarkdownImage[] }

type Orientation = 'portrait' | 'square' | 'landscape'

function orientationOf({ width, height }: ImageDimensions): Orientation {
  if (height > width * 1.1) return 'portrait'
  if (width > height * 1.1) return 'landscape'
  return 'square'
}

// Still varied, per the review feedback that a single uniform width reads
// as a stacked column -- but each image varies within a range that suits
// its shape. The old single 240/300/360 rotation gave a landscape photo
// the same 240px as a portrait, where it came out a thumbnail.
const FLOAT_WIDTHS: Record<Orientation, number[]> = {
  portrait: [240, 270, 300],
  square: [260, 300, 340],
  landscape: [340, 380, 420],
}
// For the images with no recorded dimensions: the old rotation.
const UNKNOWN_WIDTHS = [240, 300, 360]

// A bounce (0, 1, 2, 1, 0, 1, ...), not a reset-to-start cycle, so two
// adjacent images never drop straight from the largest size to the
// smallest by coincidence of where the count lands.
function bounce(widths: number[], index: number): number {
  const period = 2 * (widths.length - 1)
  const pos = index % period
  return widths[pos < widths.length ? pos : period - pos]
}

// Never wider than the file itself -- floating a 220px scan at 300 only
// blurs it.
export function floatWidth(dims: ImageDimensions | undefined, index: number): number {
  if (!dims) return bounce(UNKNOWN_WIDTHS, index)
  return Math.min(bounce(FLOAT_WIDTHS[orientationOf(dims)], index), dims.width)
}

// Most of the archive's embedded images are portraits, so an image with
// no recorded size is assumed to be one.
export function aspectRatio(dims: ImageDimensions | undefined): number {
  return dims && dims.height > 0 ? dims.width / dims.height : 0.75
}

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g
const IMAGE_ONLY_BLOCK = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/

export function imagesIn(markdown: string): MarkdownImage[] {
  return [...markdown.matchAll(MARKDOWN_IMAGE)].map(([, alt, src, modifier]) => ({
    alt,
    src,
    modifier,
  }))
}

function toBlocks(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function imageOnly(block: string): MarkdownImage | null {
  const match = IMAGE_ONLY_BLOCK.exec(block)
  if (!match) return null
  const [, alt, src, modifier] = match
  return { alt, src, modifier }
}

// "wide" and an explicit pixel width are someone's deliberate choice for
// that one image, so they never get pulled into a strip. "stack" was the
// hand-applied workaround for exactly the runs a strip now handles.
function strippable(image: MarkdownImage): boolean {
  return image.modifier === undefined || image.modifier === 'stack'
}

// Two or more images in consecutive paragraphs of their own become one
// strip, side by side. Floated one after another they either lined up
// across the column and squeezed the text into a channel, or (as
// "stack") ran down the page at full size one after another.
//
// A lone image that ends the document is set the same way, centred below
// the text: there is nothing after it to wrap, so floating it only
// extended the right-hand margin into empty page (SS Lessing, doc 228).
export function segmentContent(markdown: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  let text: string[] = []
  let run: MarkdownImage[] = []
  let runBlocks: string[] = []

  const flushRun = (atEnd = false) => {
    if (run.length >= 2 || (atEnd && run.length === 1 && text.length > 0)) {
      if (text.length) segments.push({ kind: 'markdown', text: text.join('\n\n') })
      text = []
      segments.push({ kind: 'strip', images: run })
    } else {
      text.push(...runBlocks)
    }
    run = []
    runBlocks = []
  }

  for (const block of toBlocks(markdown)) {
    const image = imageOnly(block)
    if (image && strippable(image)) {
      run.push(image)
      runBlocks.push(block)
    } else {
      flushRun()
      text.push(block)
    }
  }
  // A hand-sized image ({{image:ID:300}}) never joins a run, but the
  // width chose a size, not a float -- so it ends a document the same way.
  const last =
    run.length === 0 && text.length > 1 ? imageOnly(text[text.length - 1]) : null
  if (last && last.modifier && /^\d+$/.test(last.modifier)) {
    text.pop()
    run = [last]
  }
  flushRun(true)
  if (text.length) segments.push({ kind: 'markdown', text: text.join('\n\n') })
  return segments
}

// A document whose images are the substance and whose text is a line or
// two of framing: a scanned certificate, a call letter, a clipping. Laid
// out as prose-with-pictures, the scan became a 240px thumbnail beside a
// sentence. Here every image is shown large, in reading order.
export function isExhibit(markdown: string): boolean {
  const blocks = toBlocks(markdown)
  const images = imagesIn(markdown).length
  if (images === 0) return false
  const textBlocks = blocks.filter((block) => !imageOnly(block)).length
  return textBlocks <= 1 || textBlocks < images
}
