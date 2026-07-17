import Layout from '../components/Layout'
import RandomHeaderImage from '../components/RandomHeaderImage'
import { getAllGalleryPhotos, pickRandomPhoto } from '../utils/randomPhoto'

// Picked once at module load (not during render, which must stay pure) --
// purely decorative, no connection to the contact content itself. Varies
// across page reloads, stable across client-side navigation within one.
const HEADER_PHOTO = pickRandomPhoto(getAllGalleryPhotos())

export default function ContactPage() {
  return (
    <Layout>
      <div className="p-6">
        <RandomHeaderImage photo={HEADER_PHOTO} />

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
