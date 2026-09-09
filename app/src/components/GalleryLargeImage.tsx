import { MouseEvent, useState } from 'react'
import { GalleryPhoto } from '../data-access/public/galleries'
import { useHeaderRef } from '../hooks/useHeaderRef'
import ChevronButton from './ChevronButton'
import InlineMarkdown from './InlineMarkdown'
import Modal from './Modal'

// See FamilyHeader in FamilyPage.tsx for why this is its own component:
// useHeaderRef() must be called from within Layout's children.
export default function GalleryLargeImage({
  photo,
  onPrev,
  onNext,
}: {
  photo: GalleryPhoto
  onPrev: () => void
  onNext: () => void
}) {
  const headerRef = useHeaderRef()
  const [isZoomed, setIsZoomed] = useState(false)

  // Chevrons sit inside the image's own click-to-zoom area, so their clicks
  // must not also trigger the zoom.
  function handlePrev(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    onPrev()
  }
  function handleNext(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    onNext()
  }

  return (
    <div>
      {/* The zoom target is a button nested *beside* the chevrons rather
          than wrapping them: a <button> cannot legally contain other
          buttons, so making the whole outer box clickable (as it was)
          and keyboard-accessible are mutually exclusive. The outer div
          keeps the ref, the sizing and the `group` for hover, and the
          chevrons become siblings layered over the image button. */}
      <div
        ref={headerRef}
        className="group relative max-w-4xl h-64 sm:h-96 bg-fe-brown/20 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="w-full h-full flex items-center justify-center cursor-zoom-in"
          // photo.title is genuinely empty for some real gallery rows,
          // which produced a dangling "Zoom in on " -- a screen reader
          // announces that as a button with no subject. Verified against
          // the live data rather than assumed.
          aria-label={photo.title ? `Zoom in on ${photo.title}` : 'Zoom in on this photo'}
        >
          <img
            src={photo.url}
            alt={photo.title}
            className="w-full h-full object-contain"
          />
        </button>
        {/* focus-visible alongside group-hover -- these are invisible
            until hover, which a keyboard user never triggers, so without
            it they'd be focusable but unseeable: the tab order would
            appear to stop on nothing. */}
        <ChevronButton
          direction="left"
          onClick={handlePrev}
          label="Previous photo"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 opacity-0 group-hover:opacity-70 focus-visible:opacity-100"
        />
        <ChevronButton
          direction="right"
          onClick={handleNext}
          label="Next photo"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 opacity-0 group-hover:opacity-70 focus-visible:opacity-100"
        />
      </div>
      <p className="max-w-4xl mt-2 text-sm text-fe-ink/70 text-right">
        {/* Captions are authored in markdown -- 21 of the 349 published
            gallery photos use *italics* or **bold**, most often for the
            title of a publication. Rendered as plain text they showed
            their asterisks, which is how the 1867 Jugend-Blaetter
            gallery surfaced this. InlineMarkdown renders as a span, so
            it drops into this sentence without breaking the layout. */}
        <strong className="text-fe-ink">
          <InlineMarkdown>{photo.title}</InlineMarkdown>
        </strong>{' '}
        -- <InlineMarkdown>{photo.caption}</InlineMarkdown>
        {(photo.location || photo.year_taken || photo.credit) && (
          <>
            {' '}
            <span className="text-fe-ink/50">
              ({photo.location}
              {photo.year_taken ? `, ${photo.year_taken}` : ''}
              {photo.credit ? ` · Photo: ${photo.credit}` : ''})
            </span>
          </>
        )}
      </p>

      <Modal open={isZoomed} onClose={() => setIsZoomed(false)}>
        {/* The caption used to sit in an absolutely-positioned bar over
            the bottom of the image -- on a large photo or a long caption,
            that shaded bar covered real photo content instead of framing
            it. Stacked below the image instead, with a real gap, so it
            never overlaps -- max-h on the image leaves room within the
            90vh modal budget for the caption block underneath it. */}
        <div className="flex flex-col max-w-[90vw] max-h-[90vh] cursor-zoom-out">
          <img
            src={photo.url}
            alt={photo.title}
            className="max-w-[90vw] max-h-[calc(90vh-6rem)] object-contain"
          />
          <div className="mt-3 bg-black/60 text-white p-4 rounded-sm">
            <p className="font-bold">
              <InlineMarkdown>{photo.title}</InlineMarkdown>
            </p>
            <p className="text-sm text-white/80">
              <InlineMarkdown>{photo.caption}</InlineMarkdown>
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
