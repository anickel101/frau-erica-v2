import { useState } from 'react'
import Modal from './Modal'

// Custom ReactMarkdown <img> renderer for Document content -- markdown
// image syntax (![caption](url), resolved from {{image:ID}} shortcodes
// by data-access/public/documents.ts's resolveImagePlaceholders) renders
// through this instead of a bare, unstyled <img>. Floats right (not
// left) so paragraph text wraps around it instead of the image sitting
// on its own full-width row, with a real visible caption underneath --
// the caption text already lives in `alt` (resolveImagePlaceholders sets
// it from Images.caption), just never rendered visibly until now. Every
// embedded image gets the same click-to-zoom Modal GalleryLargeImage.tsx
// uses. width is a per-image pixel value (see TextPage.tsx's rotating
// size sequence) rather than a fixed Tailwind class, so images read as
// varied rather than a uniform stacked column; defaults to 300 (the
// previous fixed size) for any caller that doesn't pass one.
export default function DocumentEmbeddedImage({
  src,
  alt,
  width = 300,
}: {
  src?: string
  alt?: string
  width?: number
}) {
  const [isZoomed, setIsZoomed] = useState(false)
  if (!src) return null

  return (
    <figure className="float-right ml-4 mb-2" style={{ width }}>
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
        <figcaption className="mt-2 pl-4 text-[11px] leading-tight text-fe-ink/60 text-left">
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
