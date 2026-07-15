import { GalleryPhoto } from '../data-access/public/galleries'
import ChevronButton from './ChevronButton'

const VISIBLE_COUNT = 6

export default function GalleryThumbnailStrip({
  photos,
  activeIndex,
  windowStart,
  onWindowPrev,
  onWindowNext,
  onSelect,
}: {
  photos: GalleryPhoto[]
  activeIndex: number
  windowStart: number
  onWindowPrev: () => void
  onWindowNext: () => void
  onSelect: (index: number) => void
}) {
  const visible = Array.from(
    { length: Math.min(VISIBLE_COUNT, photos.length) },
    (_, i) => {
      const index = (windowStart + i) % photos.length
      return { index, photo: photos[index] }
    },
  )

  return (
    <div className="max-w-4xl mt-3 flex items-center justify-center gap-2">
      <ChevronButton
        direction="left"
        onClick={onWindowPrev}
        label="Scroll thumbnails left"
        className="w-8 h-8 shrink-0"
      />
      <div className="flex gap-2 overflow-hidden">
        {visible.map(({ index, photo }) => (
          <button
            key={photo.image_id}
            type="button"
            onClick={() => onSelect(index)}
            className={`w-20 h-20 shrink-0 bg-fe-brown/20 overflow-hidden border-2 ${
              index === activeIndex ? 'border-fe-accent' : 'border-transparent'
            }`}
          >
            <img
              src={photo.url}
              alt={photo.title}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
      <ChevronButton
        direction="right"
        onClick={onWindowNext}
        label="Scroll thumbnails right"
        className="w-8 h-8 shrink-0"
      />
    </div>
  )
}
