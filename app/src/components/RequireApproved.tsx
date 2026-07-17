import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Layout from './Layout'
import { resolveGateView } from './gateView'
import { useAuth } from '../hooks/useAuth'

function LoginTeaser() {
  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">This page requires an account</h1>
        <p className="mb-4">
          The family tree and pages for individual family members are visible only to
          people we can confirm belong to the family.
        </p>
        <p className="mb-6">
          <Link
            to="/login"
            className="bg-fe-accent hover:bg-fe-accent-dark text-white px-4 py-2 rounded-sm text-sm font-bold inline-block"
          >
            Log in
          </Link>
        </p>
        <p className="text-sm text-fe-ink/70">
          Not sure if you have access?{' '}
          <Link to="/about" className="text-fe-accent hover:text-fe-accent-dark">
            See who has access and how to request it
          </Link>
          .
        </p>
      </div>
    </Layout>
  )
}

function PendingNotice() {
  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Your access is still pending</h1>
        <p className="mb-4">
          You're signed in, but your account hasn't been approved for family-tree access
          yet.
        </p>
        <p className="text-sm text-fe-ink/70">
          If this seems like it's taking a while,{' '}
          <Link to="/contact" className="text-fe-accent hover:text-fe-accent-dark">
            contact the Archivist
          </Link>
          .
        </p>
      </div>
    </Layout>
  )
}

export default function RequireApproved({ children }: { children: ReactNode }) {
  const { status, groups } = useAuth()
  const view = resolveGateView(status, groups)

  if (view === 'loading') {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-fe-ink/60 text-sm">Loading...</p>
        </div>
      </Layout>
    )
  }

  if (view === 'teaser') return <LoginTeaser />
  if (view === 'pending') return <PendingNotice />

  return <>{children}</>
}
