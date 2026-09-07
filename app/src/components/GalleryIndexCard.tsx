import { Link } from 'react-router-dom'
import { GalleryData } from '../data-access/public/galleries'

export default function GalleryIndexCard({ gallery }: { gallery: GalleryData }) {
  const thumbnail = gallery.photos[0]

  return (
    <Link
      to={`/galleries/${gallery.gallery_id}`}
      className="block hover:opacity-80 transition"
    >
      <div className="aspect-square bg-fe-brown/20 overflow-hidden">
        {/* object-top -- see GalleryThumbnailStrip.tsx's own comment.
            Same square-crop-of-a-non-square-photo problem, same fix:
            anchor to the top so a centered crop doesn't eat into
            whatever's near the top of the frame (usually a head). */}
        {thumbnail && (
          <img
            src={thumbnail.url}
            /* Empty alt on purpose: the gallery name is already rendered
               as visible text directly below, inside the same link. A
               descriptive alt here makes a screen reader announce the
               same name twice for one card. */
            alt=""
            className="w-full h-full object-cover object-top"
          />
        )}
      </div>
      <p className="mt-2 text-sm font-bold text-fe-ink">{gallery.name}</p>
    </Link>
  )
}
