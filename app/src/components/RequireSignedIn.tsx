import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Layout from './Layout'
import { useAuth } from '../hooks/useAuth'

// Signed in, and nothing more.
//
// Deliberately NOT RequireApproved: a `pending` account -- someone who
// has requested access and is waiting on the Archivist -- still has a
// real password and must be able to change it. Gating account settings
// behind approval would mean the people most likely to have been handed
// a temporary password are the ones who cannot change it.
export default function RequireSignedIn({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-fe-ink/60 text-sm">Loading...</p>
        </div>
      </Layout>
    )
  }

  if (status === 'signedOut') {
    return (
      <Layout>
        <div className="p-6 max-w-2xl">
          <h1 className="text-2xl font-bold mb-4">You're not signed in</h1>
          <p className="mb-6">Sign in to change your password.</p>
          <p>
            <Link
              to="/login"
              className="bg-fe-accent hover:bg-fe-accent-dark text-white px-4 py-2 rounded-sm text-sm font-bold inline-block"
            >
              Log in
            </Link>
          </p>
          <p className="mt-6 text-sm text-fe-ink/70">
            Forgotten your password? The login page can email you a reset code.
          </p>
        </div>
      </Layout>
    )
  }

  return <>{children}</>
}
