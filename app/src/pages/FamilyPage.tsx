import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PersonCard from '../components/PersonCard'
import { ApiError } from '../data-access/gated/apiClient'
import { getFamilyById } from '../data-access/gated/families'
import { useAuth } from '../hooks/useAuth'
import { useSetFamilyGalleries } from '../hooks/useFamilyGalleries'
import { useHeaderRef } from '../hooks/useHeaderRef'
import { useSetNarrowTopBar } from '../hooks/useNarrowTopBar'
import { FamilyDetail, GallerySummary } from '../types/family'
import { LinkedPersonSummary } from '../types/person'
import { resolveImageUrl } from '../utils/imageUrl'

const CAPTION_MIN_WIDTH_FRACTION = 2 / 3
const CAPTION_MAX_LINES = 3

// Grows the caption's width beyond its normal 2/3 only as far as needed
// to keep it within CAPTION_MAX_LINES -- a 4-5 line caption at a fixed
// 2/3 width read as too cramped (real review feedback), but 2/3 is
// still the preferred width whenever a caption is short enough to fit
// in it. There's no pure-CSS way to size a box to a target *line
// count* (line-clamp only truncates text, it doesn't reflow wider) --
// this measures the real rendered height at increasing candidate
// widths and locks in the narrowest one that fits. useLayoutEffect,
// not useEffect, so every intermediate width tried during the search
// happens before the browser paints -- nothing flashes on screen.
function FamilyCaption({ caption }: { caption: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [widthPercent, setWidthPercent] = useState(CAPTION_MIN_WIDTH_FRACTION * 100)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
    const step = (1 - CAPTION_MIN_WIDTH_FRACTION) / 12
    let fraction = CAPTION_MIN_WIDTH_FRACTION
    el.style.width = `${fraction * 100}%`
    while (fraction < 1 && el.scrollHeight > lineHeight * CAPTION_MAX_LINES + 1) {
      fraction = Math.min(1, fraction + step)
      el.style.width = `${fraction * 100}%`
    }
    setWidthPercent(fraction * 100)
  }, [caption])

  return (
    <div
      ref={ref}
      style={{ width: `${widthPercent}%` }}
      className="ml-auto text-right text-[12px] leading-tight text-fe-ink/70 hyphens-none text-pretty"
    >
      <ReactMarkdown>{caption}</ReactMarkdown>
    </div>
  )
}

// Shown whenever a family has no header image of its own on record --
// every Family page gets a real photo instead of a blank "No header
// image" placeholder, until one exists for that specific family.
const DEFAULT_HEADER_IMAGE = 'hdr.MuellerFarm2.jpg'

// Header image band -- capped at the same max width as the text content
// below. This matters once real photos are wired in: an unconstrained-width
// image would stretch past its natural resolution on wide screens.
// Rendered as its own component (rather than inline in FamilyPage) because
// useHeaderRef() needs to be called from within Layout's children -- Layout
// renders HeaderRefContext.Provider around {children}, and FamilyPage itself
// is Layout's parent, not a descendant of that provider.
//
// The ref stays on the image-only div, not a wrapper around the caption too
// -- matches GalleryLargeImage's own header/caption split, so the sidebar
// divider keeps aligning with the photo's bottom edge specifically, the
// same "in line with the header image" behavior as every other page with
// one, regardless of how long a given family's caption happens to run.
function FamilyHeader({
  imageUrl,
  caption,
}: {
  imageUrl: string
  caption: string | null
}) {
  const headerRef = useHeaderRef()
  return (
    <>
      <div
        ref={headerRef}
        className="max-w-4xl h-64 sm:h-80 bg-fe-brown/20 flex items-center justify-center"
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </div>
      {/* Outer div matches the header image's own width (max-w-4xl);
          FamilyCaption is the actual caption box -- flush against the
          image's right edge (ml-auto), ragged-left (text-right), sized
          by FamilyCaption itself (2/3 width by default, wider only if
          needed to stay within 3 lines -- see its own comment). */}
      {caption && (
        <div className="max-w-4xl mt-2">
          <FamilyCaption caption={caption} />
        </div>
      )}
    </>
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

// Same shape as FamilySidebarGalleries above -- opts into the
// width-matched top accent bar (see Layout.tsx's topBarStyle) for as
// long as a Family page is mounted, reverting to the default full-width
// bar on navigating away.
function FamilyNarrowTopBar() {
  const setNarrowTopBar = useSetNarrowTopBar()
  useEffect(() => {
    setNarrowTopBar(true)
    return () => setNarrowTopBar(false)
  }, [setNarrowTopBar])
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

// One grandparent column's worth of boxes for one side of the couple.
// Two rules, both from real review feedback:
//  - If this side's parent (person_1/person_2) doesn't exist at all (a
//    single-parent Families row), there's no spouse to have parents of
//    their own -- render nothing, not even a placeholder.
//  - Otherwise always show two boxes, real data first: 0 known parents
//    means two "No data available" boxes, 1 known means the real box
//    plus one placeholder for the missing second parent. (More than 2
//    is possible -- e.g. one biological plus one step-parent on record
//    simultaneously -- in which case there's no missing slot to fill,
//    so every real box just renders with no padding.)
//
// Never shows a germline diamond -- see the couple grid below for why.
function renderGrandparentColumn(
  person: LinkedPersonSummary | null,
  grandparents: LinkedPersonSummary[],
) {
  if (!person) return null
  const slotCount = Math.max(2, grandparents.length)
  return Array.from({ length: slotCount }, (_, i) => {
    const p = grandparents[i]
    return p ? (
      <PersonCard
        key={p.person_id}
        person={p}
        generation="grandparent"
        isInGermline={false}
      />
    ) : (
      <EmptyGrandparentBox key={`empty-${i}`} />
    )
  })
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
      <FamilyNarrowTopBar />
      {/* Single padded wrapper for the whole content area (image + text),
          using the same p-6 (24px) as the sidebar's own padding -- this
          keeps top and left spacing in sync with the sidebar by
          construction, rather than as two separately-tuned values that
          can drift apart. */}
      <div className="p-6">
        <FamilyHeader
          imageUrl={resolveImageUrl(family.header_image_url ?? DEFAULT_HEADER_IMAGE)}
          caption={family.header_image_caption}
        />

        <div className="max-w-4xl mt-8">
          {/* text-xl/2xl, not the site's usual text-2xl/3xl -- a family
              heading can run long (multiple names), and a slightly
              smaller size gives it more room before wrapping awkwardly.
              Same reasoning applies to Gallery/Document titles. */}
          <h1 className="text-xl sm:text-2xl font-bold mb-4">{familyHeading(family)}</h1>

          {family.description && (
            // pl-15.25 (61px) lines this text up with the name text
            // inside a PersonCard box below, not an arbitrary indent --
            // that's border (1px) + p-4 (16px) + the glyph slot (w-8,
            // 32px) + gap-3 (12px) PersonCard.tsx's own box actually
            // uses to place its name text. If any of those change, this
            // needs to move with them.
            <div className="max-w-none mb-8 pl-15.25 text-[12px] text-fe-ink">
              <ReactMarkdown>{family.description}</ReactMarkdown>
            </div>
          )}

          {/* Grandparents: two columns, one per side of the couple --
              grandparents_1 stacks in the left column (above person_1
              below), grandparents_2 stacks in the right column (above
              person_2), not interleaved across rows. See
              renderGrandparentColumn for the no-spouse-means-no-boxes /
              always-pad-to-two rules. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {/* gap-1.5, not gap-3 -- tighter vertical spacing between two
                same-color (both lilac) boxes stacked in one column, per
                review feedback. The doubled mb-6 above/below this whole
                grid (spacing between *different*-color generations) is
                unrelated and untouched. */}
            <div className="flex flex-col gap-1.5">
              {renderGrandparentColumn(family.person_1, family.grandparents_1)}
            </div>
            <div className="flex flex-col gap-1.5">
              {renderGrandparentColumn(family.person_2, family.grandparents_2)}
            </div>
          </div>

          {/* The featured couple. isDivorced switches the grid to a
              3-column template with the dashes as a middle item -- see
              coupleGridCols above for why that's conditional, not
              unconditional. Desktop only (hidden sm:flex): three
              *vertical* dashes read correctly between side-by-side
              boxes, not between mobile's vertically stacked ones. */}
          {/* gap-x-3 (unchanged, side-by-side spacing) / gap-y-1.5
              (tightened -- same-color vertical stacking on mobile, where
              this grid collapses to one column). */}
          {/* Never shows a germline diamond, like the grandparents above --
              real review feedback: a diamond here is only ever telling you
              something you already knew (browsing up via a diamond-marked
              child) or, at best, something the child boxes below will say
              again on the very next click. The one case that loses real
              signal -- landing on this page a different way (a sidebar
              Ancestry link, search) with no preceding diamond -- was a
              known, deliberate tradeoff, not an oversight. */}
          <div
            className={`grid grid-cols-1 ${coupleGridCols} gap-x-3 gap-y-1.5 mb-6 items-center`}
          >
            {family.person_1 && (
              <PersonCard
                person={family.person_1}
                generation="couple"
                isInGermline={false}
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
                isInGermline={false}
              />
            )}
          </div>

          {/* Children, if any -- gap-x-3/gap-y-1.5 for the same reason
              as the couple grid above. */}
          {family.children.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
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
