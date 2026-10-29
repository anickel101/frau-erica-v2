import DocumentEmbeddedImage from './DocumentEmbeddedImage'
import {
  aspectRatio,
  type ImageDimensions,
  type MarkdownImage,
} from '../utils/documentImageLayout'

// The height a strip aims for. Without a cap, two portraits side by side
// across the full column come out over half a metre tall on a desktop
// monitor; the strip's max-width is what each row's widths add up to at
// this height, so a short row of narrow images stays modest and centred.
//
// Except that a tall newspaper column at 320px high is 110px wide and
// unreadable (H.C. Nickel's obituary, doc 110), so the row grows until
// its narrowest image is at least MIN_ITEM_WIDTH across.
const ROW_HEIGHT = 320
const MAX_ROW_HEIGHT = 640
const MIN_ITEM_WIDTH = 200
const GAP = 16

function rowHeight(aspects: number[]): number {
  const needed = MIN_ITEM_WIDTH / Math.min(...aspects)
  return Math.min(Math.max(ROW_HEIGHT, needed), MAX_ROW_HEIGHT)
}

// Several images in consecutive paragraphs of their own (see
// segmentContent), side by side at one height. On a phone they stack,
// each held to the width it would have at ROW_HEIGHT so a portrait isn't
// blown up to the full screen.
export default function DocumentImageStrip({
  images,
  dimensions,
}: {
  images: MarkdownImage[]
  dimensions: (src: string) => ImageDimensions | undefined
}) {
  const aspects = images.map((image) => aspectRatio(dimensions(image.src)))
  // A lone hand-sized image (see segmentContent) keeps its chosen width.
  const pinned =
    images.length === 1 && /^\d+$/.test(images[0].modifier ?? '')
      ? Number(images[0].modifier)
      : undefined
  const height = pinned ? pinned / aspects[0] : rowHeight(aspects)
  const naturalWidth =
    aspects.reduce((sum, aspect) => sum + aspect * height, 0) + GAP * (images.length - 1)

  return (
    <div
      className="clear-both mx-auto mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start lg:flex-nowrap"
      style={{ maxWidth: naturalWidth }}
    >
      {images.map((image, i) => (
        <DocumentEmbeddedImage
          key={`${image.src}-${i}`}
          src={image.src}
          alt={image.alt}
          layout={{
            kind: 'strip',
            aspect: aspects[i],
            mobileMaxWidth: Math.round(aspects[i] * height),
          }}
        />
      ))}
    </div>
  )
}
