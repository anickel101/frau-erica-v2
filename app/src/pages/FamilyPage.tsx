import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PersonCard from '../components/PersonCard'
import { ApiError } from '../data-access/gated/apiClient'
import { getFamilyById } from '../data-access/gated/families'
import { useAuth } from '../hooks/useAuth'
import { useHeaderRef } from '../hooks/useHeaderRef'
import { FamilyDetail } from '../types/family'
import { resolveImageUrl } from '../utils/imageUrl'

// Header image band -- capped at the same max width as the text content
// below. This matters once real photos are wired in: an unconstrained-width
// image would stretch past its natural resolution on wide screens. Falls
// back to a plain accent block if no header image exists for this family.
// Rendered as its own component (rather than inline in FamilyPage) because
// useHeaderRef() needs to be called from within Layout's children -- Layout
// renders HeaderRefContext.Provider around {children}, and FamilyPage itself
// is Layout's parent, not a descendant of that provider.
function FamilyHeader({ imageUrl }: { imageUrl: string | undefined }) {
  const headerRef = useHeaderRef()
  return (
    <div
      ref={headerRef}
      className="max-w-4xl h-64 sm:h-80 bg-fe-brown/20 flex items-center justify-center"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <p className="text-fe-ink/40 text-sm">No header image</p>
      )}
    </div>
  )
}

// person_1/person_2 are individually nullable (schema.sql allows
// single-parent Families rows) -- builds "Anson Nickel and Reva Gaur",
// "Anson Nickel", or "" depending on which are present.
function familyHeading(family: FamilyDetail): string {
  return [family.person_1, family.person_2]
    .filter((p) => p !== null)
    .map((p) => `${p.first_name} ${p.last_name}`)
    .join(' and ')
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; family: FamilyDetail }
  | { status: 'notFound' }
  | { status: 'error' }

export default function FamilyPage() {
  const { id } = useParams<{ id: string }>()
  const { idToken } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const familyId = Number(id)
    if (!idToken || !Number.isInteger(familyId)) return
    let cancelled = false
    // Deferred a microtask so this reset doesn't fire synchronously
    // within the effect body itself (react-hooks/set-state-in-effect) --
    // needed because navigating between two /family/:id pages via a
    // PersonCard click reuses this same component instance (id just
    // changes), so without a reset the previous family would keep
    // showing until the new fetch resolves.
    void Promise.resolve().then(() => {
      if (!cancelled) setState({ status: 'loading' })
    })
    getFamilyById(familyId, idToken)
      .then((family) => {
        if (!cancelled) setState({ status: 'loaded', family })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: err instanceof ApiError && err.status === 404 ? 'notFound' : 'error',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, idToken])

  if (state.status !== 'loaded') {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-fe-ink/60 text-sm">
            {state.status === 'loading' && 'Loading...'}
            {state.status === 'notFound' && "This family page doesn't exist."}
            {state.status === 'error' && 'Something went wrong loading this family.'}
          </p>
        </div>
      </Layout>
    )
  }

  const { family } = state

  return (
    <Layout>
      {/* Single padded wrapper for the whole content area (image + text),
          using the same p-6 (24px) as the sidebar's own padding -- this
          keeps top and left spacing in sync with the sidebar by
          construction, rather than as two separately-tuned values that
          can drift apart. */}
      <div className="p-6">
        <FamilyHeader
          imageUrl={
            family.header_image_url ? resolveImageUrl(family.header_image_url) : undefined
          }
        />

        <div className="max-w-4xl mt-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">{familyHeading(family)}</h1>

          {family.description && (
            <div className="prose prose-sm max-w-none mb-8 text-fe-ink/90">
              <ReactMarkdown>{family.description}</ReactMarkdown>
            </div>
          )}

          {/* Grandparents: two columns, one per side of the couple */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {family.grandparents_1.map((p) => (
              <PersonCard key={p.person_id} person={p} generation="grandparent" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {family.grandparents_2.map((p) => (
              <PersonCard key={p.person_id} person={p} generation="grandparent" />
            ))}
          </div>

          {/* The featured couple */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {family.person_1 && (
              <PersonCard person={family.person_1} generation="couple" />
            )}
            {family.person_2 && (
              <PersonCard person={family.person_2} generation="couple" />
            )}
          </div>

          {/* Children, if any */}
          {family.children.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {family.children.map((p) => (
                <PersonCard key={p.person_id} person={p} generation="child" />
              ))}
            </div>
          )}

          {/* Bottom accent bar -- 24px tall (matching the top bar) and
              width-matched to the header image/content column, NOT the
              full page width. Uses the same max-w-4xl as everything
              else above, so it stays in sync automatically. */}
          <div className="h-6 bg-fe-accent mt-8" />
        </div>
      </div>
    </Layout>
  )
}
