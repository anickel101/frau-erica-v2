import { useState } from 'react'
import Modal from './Modal'

// Sibling to DocumentEmbeddedImage.tsx, for the {{image:ID:wide}} shortcode
// modifier (see data-access/public/documents.ts) -- a document's occasional
// full-width hero image (e.g. a header photo opening the piece) instead of
// the usual float-right, fixed-width treatment every other embedded image
// gets. Same click-to-zoom Modal and stacked-caption pattern as
// DocumentEmbeddedImage/GalleryLargeImage, just not floated and sized to
// the full content column instead of a rotating pixel width.
export default function DocumentWideImage({ src, alt }: { src?: string; alt?: string }) {
  const [isZoomed, setIsZoomed] = useState(false)
  if (!src) return null

  return (
    <figure className="mb-6">
      {/* See DocumentEmbeddedImage for why this is a button. */}
      <button
        type="button"
        onClick={() => setIsZoomed(true)}
        className="block w-full cursor-zoom-in"
        aria-label={alt ? `Zoom in on ${alt}` : 'Zoom in on this image'}
      >
        <img src={src} alt={alt ?? ''} className="w-full h-auto rounded-sm shadow-sm" />
      </button>
      {alt && (
        <figcaption className="mt-2 text-[11px] leading-tight text-fe-ink/60 text-left">
          {alt}
        </figcaption>
      )}
      <Modal open={isZoomed} onClose={() => setIsZoomed(false)}>
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
