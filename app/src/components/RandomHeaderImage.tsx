import { GalleryPhoto } from '../data-access/public/galleries'
import { useHeaderRef } from '../hooks/useHeaderRef'

// Shared header block for pages with a purely decorative random photo
// (Home, Contact, User's Guide) -- previously three byte-identical
// components differing only in name. See FamilyHeader in FamilyPage.tsx
// for why this needs to be its own component: useHeaderRef() must be
// called from within Layout's children.
export default function RandomHeaderImage({
  photo,
}: {
  photo: GalleryPhoto | undefined
}) {
  const headerRef = useHeaderRef()
  return (
    <div
      ref={headerRef}
      className="max-w-4xl h-64 sm:h-80 bg-fe-brown/20 flex items-center justify-center overflow-hidden"
    >
      {photo ? (
        <img src={photo.url} alt="" className="w-full h-full object-cover" />
      ) : (
        <p className="text-fe-ink/40 text-sm">No header image</p>
      )}
    </div>
  )
}
