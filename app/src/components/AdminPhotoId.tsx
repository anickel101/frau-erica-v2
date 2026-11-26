import { Link } from 'react-router-dom'
import AdminOnly from './AdminOnly'

// "Photo #3105 · Edit", for admins only, under a photograph wherever one
// is shown enlarged -- the pop-up, a person's photos page, a gallery, a
// photo in a text. The number is how a photograph is found everywhere
// else (the editors, the Hidden page, a note to whoever applies edits);
// without it, the archivist had only the picture to go on. Visitors
// don't see it.
export default function AdminPhotoId({
  imageId,
  onDark = false,
  className = '',
}: {
  imageId: number | undefined
  // Inside a zoom view's dark backdrop.
  onDark?: boolean
  className?: string
}) {
  if (imageId === undefined) return null
  return (
    <AdminOnly>
      {/* stopPropagation: a zoom view closes on any click, and selecting
          the number to copy it must not close it. */}
      <p
        onClick={(e) => e.stopPropagation()}
        className={`text-xs ${onDark ? 'text-white/70' : 'text-fe-ink/60'} ${className}`}
      >
        Photo #{imageId} ·{' '}
        <Link
          to={`/admin/edit/image/${imageId}`}
          className={
            onDark ? 'text-white underline' : 'text-fe-link hover:text-fe-link-dark'
          }
        >
          Edit
        </Link>
      </p>
    </AdminOnly>
  )
}
