import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

// Catch-all for unmatched routes. Worth more than the usual amount here:
// the original frauerica.org used a completely different URL scheme
// (PHP query strings like /Images/_Gallery.php?...), so old bookmarks and
// links pasted into family emails will land on paths this app has never
// heard of. Without this route they'd render a blank page with no way out.
export default function NotFoundPage() {
  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">That page doesn't exist</h1>
        <p className="mb-4">
          The link may be from the old version of this site, which used different
          addresses -- or it may just have a typo in it.
        </p>
        <ul className="mb-6 space-y-1 text-sm">
          <li>
            <Link to="/" className="text-fe-link hover:text-fe-link-dark">
              Home
            </Link>
          </li>
          <li>
            <Link to="/documents" className="text-fe-link hover:text-fe-link-dark">
              Index of Texts
            </Link>
          </li>
          <li>
            <Link to="/galleries" className="text-fe-link hover:text-fe-link-dark">
              Index of Galleries
            </Link>
          </li>
          <li>
            <Link to="/persons" className="text-fe-link hover:text-fe-link-dark">
              Index of Persons
            </Link>
          </li>
        </ul>
        <p className="text-sm text-fe-ink/70">
          Looking for something specific?{' '}
          <Link to="/contact" className="text-fe-link hover:text-fe-link-dark">
            Contact the Archivist
          </Link>
          .
        </p>
      </div>
    </Layout>
  )
}
