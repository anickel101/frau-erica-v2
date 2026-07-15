import { MouseEvent, useState } from 'react'
import { GalleryPhoto } from '../data-access/public/galleries'
import { useHeaderRef } from '../hooks/useHeaderRef'
import ChevronButton from './ChevronButton'
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
      <div
        ref={headerRef}
        onClick={() => setIsZoomed(true)}
        className="group relative max-w-4xl h-64 sm:h-96 bg-fe-brown/20 flex items-center justify-center cursor-zoom-in overflow-hidden"
      >
        <img src={photo.url} alt={photo.title} className="w-full h-full object-contain" />
        <ChevronButton
          direction="left"
          onClick={handlePrev}
          label="Previous photo"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 opacity-0 group-hover:opacity-70"
        />
        <ChevronButton
          direction="right"
          onClick={handleNext}
          label="Next photo"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 opacity-0 group-hover:opacity-70"
        />
      </div>
      <p className="max-w-4xl mt-2 text-sm text-fe-ink/70">
        <strong className="text-fe-ink">{photo.title}</strong> -- {photo.caption}{' '}
        <span className="text-fe-ink/50">
          ({photo.location}
          {photo.year_taken ? `, ${photo.year_taken}` : ''}
          {photo.credit ? ` · Photo: ${photo.credit}` : ''})
        </span>
      </p>

      <Modal open={isZoomed} onClose={() => setIsZoomed(false)}>
        <div className="relative max-w-[90vw] max-h-[90vh] cursor-zoom-out">
          <img
            src={photo.url}
            alt={photo.title}
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-4">
            <p className="font-bold">{photo.title}</p>
            <p className="text-sm text-white/80">{photo.caption}</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
