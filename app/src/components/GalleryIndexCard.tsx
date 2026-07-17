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
        {thumbnail && (
          <img
            src={thumbnail.url}
            alt={gallery.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <p className="mt-2 text-sm font-bold text-fe-ink">{gallery.name}</p>
    </Link>
  )
}
