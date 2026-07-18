import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PersonCard from '../components/PersonCard'
import { ApiError } from '../data-access/gated/apiClient'
import { getFamilyById } from '../data-access/gated/families'
import { useAuth } from '../hooks/useAuth'
import { useSetFamilyGalleries } from '../hooks/useFamilyGalleries'
import { useHeaderRef } from '../hooks/useHeaderRef'
import { FamilyDetail, GallerySummary } from '../types/family'
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

// Also rendered inside <Layout>'s children, same reason as FamilyHeader
// above -- pushes this family's linked galleries out to the sidebar via
// useSetFamilyGalleries(), clearing them again on unmount (leaving the
// page) or once a new family's galleries arrive (navigating to a
// different /family/:id, same component instance).
function FamilySidebarGalleries({ galleries }: { galleries: GallerySummary[] }) {
  const setFamilyGalleries = useSetFamilyGalleries()
  useEffect(() => {
    setFamilyGalleries(galleries)
    return () => setFamilyGalleries(null)
  }, [setFamilyGalleries, galleries])
  return null
}

// Fills a grandparent slot with no data on record, so the purple
// generational box is still visually present (matching PersonCard's own
// shell -- padding, border, rounded corners, the same reserved glyph
// slot for alignment) rather than just leaving a gap. Mirrors
// PersonCard's own two-line text block (name + birth date) exactly,
// down to a second line reserved with a non-breaking space -- most real
// boxes show a birth date, so a single-line placeholder would render
// visibly shorter than a typical filled box.
function EmptyGrandparentBox() {
  return (
    <div className="flex items-center gap-3 p-4 border border-black/10 rounded-sm bg-fe-gen-grandparent">
      <span className="text-fe-accent text-3xl leading-none w-8 shrink-0 text-center" />
      <div>
        <p className="font-bold text-sm text-fe-ink/60 italic">No data available</p>
        <p className="text-xs text-fe-ink/70">&nbsp;</p>
      </div>
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
  const { idToken, germlineIds } = useAuth()
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
  const isInGermline = (personId: number) => germlineIds?.has(personId) ?? false
  // Switching unconditionally to a 3-column [1fr_auto_1fr] template
  // would add an extra reserved gap for every non-divorced family --
  // the overwhelming majority -- so the template itself is conditional,
  // not just the dashes inside it.
  const isDivorced =
    family.person_1 !== null &&
    family.person_2 !== null &&
    family.coupleStatus === 'divorced'
  const coupleGridCols = isDivorced ? 'sm:grid-cols-[1fr_auto_1fr]' : 'sm:grid-cols-2'

  return (
    <Layout>
      <FamilySidebarGalleries galleries={family.galleries} />
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
            <div className="max-w-none mb-8 text-[12px] text-fe-ink">
              <ReactMarkdown>{family.description}</ReactMarkdown>
            </div>
          )}

          {/* Grandparents: two columns, one per side of the couple --
              grandparents_1 stacks in the left column (above person_1
              below), grandparents_2 stacks in the right column (above
              person_2), not interleaved across rows. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="flex flex-col gap-3">
              {family.grandparents_1.length > 0 ? (
                family.grandparents_1.map((p) => (
                  <PersonCard
                    key={p.person_id}
                    person={p}
                    generation="grandparent"
                    isInGermline={isInGermline(p.person_id)}
                  />
                ))
              ) : (
                <EmptyGrandparentBox />
              )}
            </div>
            <div className="flex flex-col gap-3">
              {family.grandparents_2.length > 0 ? (
                family.grandparents_2.map((p) => (
                  <PersonCard
                    key={p.person_id}
                    person={p}
                    generation="grandparent"
                    isInGermline={isInGermline(p.person_id)}
                  />
                ))
              ) : (
                <EmptyGrandparentBox />
              )}
            </div>
          </div>

          {/* The featured couple. isDivorced switches the grid to a
              3-column template with the dashes as a middle item -- see
              coupleGridCols above for why that's conditional, not
              unconditional. Desktop only (hidden sm:flex): three
              *vertical* dashes read correctly between side-by-side
              boxes, not between mobile's vertically stacked ones. */}
          <div className={`grid grid-cols-1 ${coupleGridCols} gap-3 mb-6 items-center`}>
            {family.person_1 && (
              <PersonCard
                person={family.person_1}
                generation="couple"
                isInGermline={isInGermline(family.person_1.person_id)}
              />
            )}
            {isDivorced && (
              <div
                className="hidden sm:flex flex-col items-center justify-center gap-1"
                aria-hidden="true"
              >
                <span className="w-0.5 h-2 bg-fe-ink/40" />
                <span className="w-0.5 h-2 bg-fe-ink/40" />
                <span className="w-0.5 h-2 bg-fe-ink/40" />
              </div>
            )}
            {family.person_2 && (
              <PersonCard
                person={family.person_2}
                generation="couple"
                isInGermline={isInGermline(family.person_2.person_id)}
              />
            )}
          </div>

          {/* Children, if any */}
          {family.children.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {family.children.map((p) => (
                <PersonCard
                  key={p.person_id}
                  person={p}
                  generation="child"
                  isInGermline={isInGermline(p.person_id)}
                />
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
