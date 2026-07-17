import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { resolveAdminGateView } from './adminGateView'
import Layout from './Layout'
import { useAuth } from '../hooks/useAuth'

function LoginTeaser() {
  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">This page requires an admin account</h1>
        <p className="mb-6">
          <Link
            to="/login"
            className="bg-fe-accent hover:bg-fe-accent-dark text-white px-4 py-2 rounded-sm text-sm font-bold inline-block"
          >
            Log in
          </Link>
        </p>
      </div>
    </Layout>
  )
}

function Forbidden() {
  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">You don't have access to this page</h1>
        <p className="text-sm text-fe-ink/70">
          This area is limited to site administrators.
        </p>
      </div>
    </Layout>
  )
}

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, groups } = useAuth()
  const view = resolveAdminGateView(status, groups)

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
  if (view === 'forbidden') return <Forbidden />

  return <>{children}</>
}
