import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { getPersonById } from '../data-access/gated/persons'
import { useAuth } from '../hooks/useAuth'

type ResolveState =
  | { kind: 'loading' }
  | { kind: 'redirect'; familyId: number }
  | { kind: 'noFamily' }
  // Distinct from 'error': the id in the URL isn't a number at all, so
  // nothing was ever attempted. Telling someone "something went wrong"
  // when the real answer is "that address isn't a person" sends them
  // chasing a fault that isn't there.
  | { kind: 'notFound' }
  | { kind: 'error' }

// There's no standalone Person detail page by design -- every place a
// person is clickable (PersonCard's grandparent/couple/child boxes) just
// wants "take me to that person's family page." This route exists only
// to resolve person_id -> family_id (preferring the family they're a
// partner in, same as AuthProvider's homeFamilyId logic) and redirect,
// rather than duplicating that resolution at every call site.
export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const { status } = useAuth()
  const [state, setState] = useState<ResolveState>({ kind: 'loading' })

  useEffect(() => {
    const personId = Number(id)
    let cancelled = false

    // See FamilyPage's matching comment: a malformed id used to share a
    // `return` with the not-signed-in case and hang on "Loading..."
    // permanently. Only one of the two ever resolves on its own.
    if (!Number.isInteger(personId)) {
      void Promise.resolve().then(() => {
        if (!cancelled) setState({ kind: 'notFound' })
      })
      return () => {
        cancelled = true
      }
    }
    if (status !== 'signedIn') return

    getPersonById(personId)
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
  }, [id, status])

  if (state.kind === 'redirect') {
    return <Navigate to={`/family/${state.familyId}`} replace />
  }

  return (
    <Layout>
      <div className="p-6">
        <p className="text-fe-ink/60 text-sm">
          {state.kind === 'loading' && 'Loading...'}
          {state.kind === 'noFamily' && "This person isn't linked to a family page yet."}
          {state.kind === 'notFound' && "This person page doesn't exist."}
          {state.kind === 'error' && 'Something went wrong loading this page.'}
        </p>
      </div>
    </Layout>
  )
}
