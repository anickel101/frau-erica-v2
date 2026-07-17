import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { getPersonById } from '../data-access/gated/persons'
import { useAuth } from '../hooks/useAuth'

type ResolveState =
  | { kind: 'loading' }
  | { kind: 'redirect'; familyId: number }
  | { kind: 'noFamily' }
  | { kind: 'error' }

// There's no standalone Person detail page by design -- every place a
// person is clickable (PersonCard's grandparent/couple/child boxes) just
// wants "take me to that person's family page." This route exists only
// to resolve person_id -> family_id (preferring the family they're a
// partner in, same as AuthProvider's homeFamilyId logic) and redirect,
// rather than duplicating that resolution at every call site.
export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const { idToken } = useAuth()
  const [state, setState] = useState<ResolveState>({ kind: 'loading' })

  useEffect(() => {
    const personId = Number(id)
    if (!idToken || !Number.isInteger(personId)) return
    let cancelled = false
    getPersonById(personId, idToken)
      .then((person) => {
        if (cancelled) return
        const familyId = person.familyIdsAsPartner[0] ?? person.familyIdAsChild
        setState(
          familyId !== null ? { kind: 'redirect', familyId } : { kind: 'noFamily' },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [id, idToken])

  if (state.kind === 'redirect') {
    return <Navigate to={`/family/${state.familyId}`} replace />
  }

  return (
    <Layout>
      <div className="p-6">
        <p className="text-fe-ink/60 text-sm">
          {state.kind === 'loading' && 'Loading...'}
          {state.kind === 'noFamily' && "This person isn't linked to a family page yet."}
          {state.kind === 'error' && 'Something went wrong loading this page.'}
        </p>
      </div>
    </Layout>
  )
}
