import { Link } from 'react-router-dom'
import AlreadySignedIn from '../components/AlreadySignedIn'
import Layout from '../components/Layout'
import LoginForm from '../components/LoginForm'
import { resolveGateView } from '../components/gateView'
import { ADELHEID_PARAGRAPHS } from '../content/adelheid'
import { useAuth } from '../hooks/useAuth'
import { resolveImageUrl } from '../utils/imageUrl'

// Which of the three right-hand panels to show. Reuses RequireApproved's
// own decision helper rather than re-deriving "is this person allowed
// in" from groups here -- it's already unit tested (gateView.test.ts),
// and a second copy of access logic is a second place for it to drift.
// The names map cleanly: 'teaser' is the signed-out case, which on this
// page means the actual login form.
function RightPanel() {
  const { status, groups } = useAuth()
  const view = resolveGateView(status, groups)

  // Nothing, deliberately, rather than a spinner or the form. The
  // session resolves in a few hundred milliseconds on load, and
  // rendering the form first would flash a login prompt at someone who
  // is already signed in -- the exact confusion this panel exists to
  // remove. The left-hand Adelheid panel still fills the page meanwhile.
  if (view === 'loading') return null

  // One <section> in every branch, since this is the second child of the
  // page's two-column grid -- returning a bare fragment here would make
  // each of its children a grid item and collapse the layout.
  return (
    <section>
      {view === 'pending' && <AlreadySignedIn pending />}
      {view === 'authorized' && <AlreadySignedIn />}
      {view === 'teaser' && (
        <>
          <h1 className="text-2xl sm:text-3xl font-bold mb-8">Welcome</h1>
          <LoginForm />
          <p className="text-sm text-fe-ink/70 mt-6">
            Not sure if you have access?{' '}
            <Link to="/about" className="text-fe-link hover:text-fe-link-dark">
              See who has access and how to request it
            </Link>
            , or{' '}
            <Link to="/contact" className="text-fe-link hover:text-fe-link-dark">
              contact the Archivist
            </Link>
            .
          </p>
        </>
      )}
    </section>
  )
}

export default function LoginPage() {
  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <div className="grid gap-8 md:grid-cols-2 items-start">
          <section className="bg-fe-bg p-6">
            <img
              src={resolveImageUrl('FrauErica5.jpg')}
              alt="Portrait of Adelheid Rickmeyer"
              className="w-full max-w-[240px] mx-auto mb-4 rounded-sm"
            />
            <h2 className="text-lg font-bold text-fe-brown mb-2">
              Meet Adelheid Rickmeyer
            </h2>
            <div className="space-y-3 text-sm">
              {ADELHEID_PARAGRAPHS.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>

          <RightPanel />
        </div>
      </div>
    </Layout>
  )
}
