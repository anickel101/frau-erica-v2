import { Link } from 'react-router-dom'
import type { GalleryPhoto } from '../data-access/public/galleries'
import { getPhotoPersons } from '../utils/galleryDisplay'
import { getFullName } from '../utils/personDisplay'

// Who is in this photograph, with a link to each person's family page.
//
// Shared between the gallery page and the zoomed modal rather than
// written twice: they show the same fact about the same picture, and a
// second copy would be the thing that quietly stops matching.
//
// Renders nothing at all for an untagged photograph, which is most of
// them -- an empty "In this photograph" would read as something broken
// rather than something not yet done.
export default function PhotoPeople({
  photo,
  tone,
}: {
  photo: GalleryPhoto
  // 'page' sits under the caption on a light ground; 'modal' sits inside
  // the dark caption block over the zoomed image.
  tone: 'page' | 'modal'
}) {
  const people = getPhotoPersons(photo)
  if (people.length === 0) return null

  const onModal = tone === 'modal'

  return (
    <p
      className={
        onModal
          ? 'mt-2 text-sm text-white/70'
          : 'max-w-4xl mt-1 text-[11px] leading-tight text-fe-ink/60 text-right'
      }
    >
      In this photograph:{' '}
      {people.map((person, index) => (
        <span key={person.person_id}>
          {index > 0 && ', '}
          {person.linkedFamilyId !== null ? (
            <Link
              to={`/family/${person.linkedFamilyId}`}
              className={
                onModal
                  ? 'text-white underline hover:text-white/80'
                  : 'text-fe-link hover:text-fe-link-dark'
              }
            >
              {getFullName(person)}
            </Link>
          ) : (
            getFullName(person)
          )}
        </span>
      ))}
    </p>
  )
}
