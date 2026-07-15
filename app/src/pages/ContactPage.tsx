import Layout from '../components/Layout'
import { GalleryPhoto, listGalleries } from '../data-access/public/galleries'
import { useHeaderRef } from '../hooks/useHeaderRef'

// Picked once at module load (not during render, which must stay pure) --
// purely decorative, no connection to the contact content itself. Varies
// across page reloads, stable across client-side navigation within one.
const allPhotos = listGalleries().flatMap((gallery) => gallery.photos)
const HEADER_PHOTO: GalleryPhoto | undefined =
  allPhotos.length > 0
    ? allPhotos[Math.floor(Math.random() * allPhotos.length)]
    : undefined

// See FamilyHeader in FamilyPage.tsx for why this is its own component:
// useHeaderRef() must be called from within Layout's children.
function ContactHeader({ photo }: { photo: GalleryPhoto | undefined }) {
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

export default function ContactPage() {
  return (
    <Layout>
      <div className="p-6">
        <ContactHeader photo={HEADER_PHOTO} />

        <div className="max-w-4xl mt-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6">Contact the Archivist</h1>

          <p className="mb-6">
            <span className="font-bold">e-mail:</span>{' '}
            <a
              href="mailto:FrauErica.archivist@gmail.com"
              className="text-fe-accent hover:text-fe-accent-dark"
            >
              FrauErica.archivist@gmail.com
            </a>
          </p>

          <div className="mb-6">
            <p className="font-bold mb-1">postal mail:</p>
            <p>
              The Frau Erica Project
              <br />
              101 Gideon Lawton Lane
              <br />
              Portsmouth RI 02871
            </p>
          </div>

          <p className="text-sm text-fe-ink/70 mb-8">
            Your e-mail address will never be shared with or sold to third parties.
          </p>

          <div className="space-y-6">
            <div>
              <h2 className="font-bold text-sm text-fe-brown mb-1">
                Need help with your account?
              </h2>
              <p className="text-sm text-fe-ink/80">
                If you're having trouble logging in, aren't sure why you don't have access
                yet, or need something on your account corrected, email the Archivist
                directly rather than filing a new request.
              </p>
            </div>

            <div>
              <h2 className="font-bold text-sm text-fe-brown mb-1">
                Want to contribute?
              </h2>
              <p className="text-sm text-fe-ink/80">
                Photos, documents, family stories, and corrections are always welcome --
                send along what you have and the Archivist will make sure it finds a home
                in the archive.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
