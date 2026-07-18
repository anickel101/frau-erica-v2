import { useState } from 'react'
import Modal from './Modal'

// Custom ReactMarkdown <img> renderer for Document content -- markdown
// image syntax (![caption](url), resolved from {{image:ID}} shortcodes
// by data-access/public/documents.ts's resolveImagePlaceholders) renders
// through this instead of a bare, unstyled <img>. Floats at a fixed
// 300px so paragraph text wraps around it instead of the image sitting
// on its own full-width row, with a real visible caption underneath --
// the caption text already lives in `alt` (resolveImagePlaceholders sets
// it from Images.caption), just never rendered visibly until now. Every
// embedded image gets the same click-to-zoom Modal GalleryLargeImage.tsx
// uses.
export default function DocumentEmbeddedImage({
  src,
  alt,
}: {
  src?: string
  alt?: string
}) {
  const [isZoomed, setIsZoomed] = useState(false)
  if (!src) return null

  return (
    <figure className="float-left w-75 mr-4 mb-2">
      <div onClick={() => setIsZoomed(true)} className="cursor-zoom-in">
        <img src={src} alt={alt ?? ''} className="w-full h-auto rounded-sm shadow-sm" />
      </div>
      {alt && (
        <figcaption className="mt-2 text-xs italic text-fe-ink/60 text-center">
          {alt}
        </figcaption>
      )}
      <Modal open={isZoomed} onClose={() => setIsZoomed(false)}>
        {/* Same relative-wrapper + bottom overlay-bar pattern as
            GalleryLargeImage.tsx's zoomed view, so a caption reads the
            same way whether it came from a gallery photo or an embedded
            document image. */}
        <div className="relative max-w-[90vw] max-h-[90vh] cursor-zoom-out">
          <img
            src={src}
            alt={alt ?? ''}
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
          {alt && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-4">
              <p className="text-sm text-white/80">{alt}</p>
            </div>
          )}
        </div>
      </Modal>
    </figure>
  )
}
