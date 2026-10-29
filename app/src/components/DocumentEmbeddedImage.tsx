import { useState, type CSSProperties } from 'react'
import Modal from './Modal'

// One embedded document image -- markdown image syntax resolved from an
// {{image:ID}} shortcode (see data-access/public/documentDetail.ts) --
// with a visible caption (the caption already lives in `alt`) and the
// same click-to-zoom Modal GalleryLargeImage.tsx uses. Where it sits is
// TextPage's decision, passed in as `layout`:
//
// - float: beside the text, right-hand side. Clears any earlier float, so
//   two images close together stack down the margin instead of lining up
//   across the column and squeezing the text into a channel between
//   them. Below sm: it doesn't float at all -- a 240px float in a 342px
//   phone column left the text one word per line. And it never takes
//   more than 45% of the column, which on a tablet (no sidebar until md:,
//   narrower column) the fixed pixel width alone would.
// - large: on its own, centred, as big as the column or the file allows.
//   For documents whose images are the substance (see isExhibit).
// - strip: one of several side by side (see DocumentImageStrip). Grows in
//   proportion to its aspect ratio so the row comes out one height.
export type EmbeddedImageLayout =
  | { kind: 'float'; width: number }
  | { kind: 'large'; maxWidth: number | undefined }
  | { kind: 'strip'; aspect: number; mobileMaxWidth: number }

function figureProps(layout: EmbeddedImageLayout): {
  className: string
  style: CSSProperties
} {
  switch (layout.kind) {
    case 'float':
      return {
        className:
          'mx-auto mb-4 w-full max-w-(--fig-w) sm:float-right sm:clear-right sm:ml-4 sm:mb-2 sm:w-[min(var(--fig-w),45%)] sm:max-w-none',
        style: { '--fig-w': `${layout.width}px` } as CSSProperties,
      }
    case 'large':
      return {
        className: 'mx-auto mb-6 clear-both',
        style: layout.maxWidth ? { maxWidth: layout.maxWidth } : {},
      }
    case 'strip':
      return {
        className:
          'mx-auto w-full min-w-0 max-w-(--mw) sm:mx-0 sm:min-w-[40%] sm:max-w-none sm:flex-[var(--ar)_1_0%] lg:min-w-0',
        // Scaled up because grow factors summing to under 1 take only that
        // fraction of the row: a lone portrait (0.75) filled 75% of it.
        // Only the ratio between items matters.
        style: {
          '--ar': layout.aspect * 100,
          '--mw': `${layout.mobileMaxWidth}px`,
        } as CSSProperties,
      }
  }
}

export default function DocumentEmbeddedImage({
  src,
  alt,
  layout,
}: {
  src?: string
  alt?: string
  layout: EmbeddedImageLayout
}) {
  const [isZoomed, setIsZoomed] = useState(false)
  if (!src) return null

  return (
    <figure {...figureProps(layout)}>
      {/* A real <button>, not a <div onClick>. The div gave the zoom no
          tab stop and no Enter/Space handling, so on a public page every
          embedded photo was unreachable without a mouse. block w-full
          keeps the button from shrink-wrapping the way an inline-block
          button would, so the layout is identical to the div's. */}
      <button
        type="button"
        onClick={() => setIsZoomed(true)}
        className="block w-full cursor-zoom-in"
        aria-label={alt ? `Zoom in on ${alt}` : 'Zoom in on this image'}
      >
        <img src={src} alt={alt ?? ''} className="w-full h-auto rounded-sm shadow-sm" />
      </button>
      {alt && (
        // Roman (not italic), flush left with a small indent from the
        // image's own left edge (~1 pica), one point size smaller than
        // the surrounding 12px body text -- all per review feedback;
        // previously italic and centered.
        <figcaption className="mt-2 pl-4 text-[11px] leading-tight text-fe-ink/60 text-left text-balance">
          {alt}
        </figcaption>
      )}
      <Modal open={isZoomed} onClose={() => setIsZoomed(false)}>
        {/* Same stacked-below-the-image caption pattern as
            GalleryLargeImage.tsx's zoomed view, so a caption reads the
            same way whether it came from a gallery photo or an embedded
            document image -- previously an overlay bar sat on top of the
            image and could obscure the bottom of it on a large photo. */}
        <div className="flex flex-col max-w-[90vw] max-h-[90vh] cursor-zoom-out">
          <img
            src={src}
            alt={alt ?? ''}
            className={`max-w-[90vw] object-contain ${alt ? 'max-h-[calc(90vh-6rem)]' : 'max-h-[90vh]'}`}
          />
          {alt && (
            <div className="mt-3 bg-black/60 text-white p-4 rounded-sm">
              <p className="text-sm text-white/80">{alt}</p>
            </div>
          )}
        </div>
      </Modal>
    </figure>
  )
}
