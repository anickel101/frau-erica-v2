import { Link } from 'react-router-dom'
import { PencilSquareIcon } from '@heroicons/react/24/outline'
import IconAction from './IconAction'
import { BOX_POINT, DiamondGlyph, GlyphSlot } from './NavigationGlyph'
import { useAuth } from '../hooks/useAuth'
import { formatLifespan } from '../utils/dateDisplay'
import { getFullName } from '../utils/personDisplay'
import { LinkedPersonSummary } from '../types/person'

type Generation = 'grandparent' | 'couple' | 'child'

const GENERATION_STYLES: Record<Generation, string> = {
  grandparent: 'bg-fe-gen-grandparent',
  couple: 'bg-fe-gen-couple',
  child: 'bg-fe-gen-child',
}

// Every generation now carries the same weight of border, in a darker
// shade of its own fill. Grandparent and child boxes used to have a 1px
// black/10 hairline, which the Archivist found too faint beside the
// couple's; the three -dark tokens are derived identically (see
// index.css), so the relationship between fill and edge is the same on
// all three rows.
const GENERATION_BORDER: Record<Generation, string> = {
  grandparent: 'border-2 border-fe-gen-grandparent-dark',
  couple: 'border-2 border-fe-gen-couple-dark',
  child: 'border-2 border-fe-gen-child-dark',
}

// A bare "i" for the More info button. Heroicons' InformationCircleIcon
// is an i inside its own circle, which inside IconAction's ring became a
// circle within a circle with a tiny letter in the middle. Heroicons has
// no bare i, so this is drawn here -- as an SVG rather than a text
// glyph, for the same reason the germline diamond is: a font-supplied
// character's position in its cell varies with whatever font ends up
// rendering it, and an SVG's bounding box does not.
//
// Sized to fill the ring the way the pencil does. Stroke 2.5 rather
// than the pencil's 1.5, because a lone stem reads lighter than an
// outlined shape of the same stroke; tried at 2 and it looked thin
// beside the pencil.
function InfoGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="10" x2="12" y2="20" />
      <circle cx="12" cy="4.75" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function PersonCard({
  person,
  generation,
  isInGermline = false,
  side,
}: {
  person: LinkedPersonSummary
  generation: Generation
  // True when this person is one of the logged-in user's own biological
  // ancestors (see hooks/useAuth.tsx's germlineIds) -- shows a diamond
  // in the glyph slot, letting someone trace their own direct line
  // through the tree. Now the only glyph a box ever shows: the ▲/▼
  // direction arrows are gone, since the box itself is the link and its
  // colour already says which generation it is.
  isInGermline?: boolean
  // Which half of the couple this box is. Decides which side the
  // other-marriage chevron sits on and points toward: a left-hand
  // partner's chevron goes on the left, pointing left. Only meaningful
  // for generation 'couple'.
  side?: 'left' | 'right'
}) {
  const { groups } = useAuth()
  const isAdmin = groups.includes('admin')

  const name = getFullName(person)

  // The couple's boxes are the page you're on, so a plain couple box
  // goes nowhere: no link, no hover, no cursor. But a partner with
  // another marriage gets a box that IS the way there -- pointed on
  // their own side, and clickable as a whole. So the rule a reader
  // learns is simply: a box that comes to a point goes somewhere.
  // Grandparent and child boxes still navigate to that person's own
  // family page.
  const hasOtherFamily = generation === 'couple' && person.otherFamilyId != null
  const pointLeft = hasOtherFamily && side === 'left'
  const pointRight = hasOtherFamily && side !== 'left'
  const pointed = pointLeft || pointRight

  const to = hasOtherFamily
    ? `/family/${person.otherFamilyId}`
    : person.linkedFamilyId !== null
      ? `/family/${person.linkedFamilyId}`
      : `/persons/${person.person_id}`
  const linkLabel = hasOtherFamily
    ? `${person.first_name}'s other marriage`
    : `${name}'s family page`
  const isNavigable = generation !== 'couple' || hasOtherFamily

  // clip-path draws the point but clips CSS borders away, so a pointed
  // box is two stacked layers -- the border colour clipped to the full
  // shape, the fill clipped to the same shape inset 2px -- with the
  // content above. The inset diagonal measures within a quarter pixel of
  // the 2px straight edges.
  const d = BOX_POINT
  const clipPath = pointed
    ? `polygon(${pointLeft ? `${d}px` : '0'} 0, ${pointRight ? `calc(100% - ${d}px)` : '100%'} 0, ` +
      `${pointRight ? `100% 50%, calc(100% - ${d}px) 100%` : '100% 100%'}, ` +
      `${pointLeft ? `${d}px 100%, 0 50%` : '0 100%'})`
    : undefined

  // Every name on the page sits 62px in from its box's left edge:
  // border 2 + p-4 16 + the glyph slot 32 + gap 12. A box pointed on
  // the left has no slot; its padding is simply the full 62, which
  // leaves 32px between the point's base and the text.
  const NAME_INSET = 62

  return (
    <div
      style={{
        paddingLeft: pointLeft ? NAME_INSET : undefined,
        paddingRight: pointRight ? d + 18 : undefined,
      }}
      className={`
        relative flex items-center gap-3
        ${pointed ? 'p-[18px]' : `p-4 rounded-sm ${GENERATION_STYLES[generation]} ${GENERATION_BORDER[generation]}`}
      `}
    >
      {pointed && (
        <>
          <div
            aria-hidden="true"
            style={{ clipPath }}
            className="absolute inset-0 bg-fe-gen-couple-dark"
          />
          <div
            aria-hidden="true"
            style={{ clipPath }}
            className="absolute inset-[2px] bg-fe-gen-couple"
          />
        </>
      )}

      {/* A "stretched" link: absolutely covers the whole box so the
          entire face is clickable -- but as a SIBLING of the icon
          buttons rather than their parent, because a <button> inside
          an <a> is invalid HTML and unreachable to assistive tech. The
          buttons sit above it (z-10), so they take their own clicks.
          On a pointed box the link is clipped to the same shape, so the
          empty corners beside the point are neither clickable nor
          hoverable. The hover is drawn on the link, not the box, so
          hovering a button doesn't dim the face. */}
      {isNavigable && (
        <Link
          to={to}
          aria-label={linkLabel}
          style={{ clipPath }}
          className="absolute inset-0 rounded-sm transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fe-accent"
        />
      )}

      {!pointLeft && <GlyphSlot>{isInGermline && <DiamondGlyph />}</GlyphSlot>}

      {/* relative, so it paints above a pointed box's two fill layers --
          but pointer-events-none, because relative also paints it above
          the stretched link, and without this a click on the name
          landed on the <p> and went nowhere. The name is the most
          obvious thing to click; it has to reach the link underneath. */}
      <div className="pointer-events-none relative min-w-0 flex-1">
        <p className="font-bold text-sm">{name}</p>
        {/* Always rendered, even with no date on record -- a
            non-breaking space reserves the same second line every
            other box gets, so boxes stay the same height whether or
            not this person has a dateline. */}
        <p className="text-xs text-fe-ink/70">
          {/* '\u00A0' written as an escape, not typed: a plain space
              collapses to nothing and the box loses its second line.
              That regression shipped once, in a rewrite of this
              file, and was only caught in a screenshot. */}
          {formatLifespan(person.date_of_birth, person.date_of_death) || '\u00A0'}
        </p>
      </div>

      {/* Couple boxes only, and right-aligned rather than floating in
          the leftover space: a fixed home at the box's edge reads as
          part of the box, where centring left them drifting with the
          length of the name. Neither icon does anything yet; both are
          present so the layout is settled before there is something
          behind them. The info dialog is built (PersonInfoDialog.tsx)
          and was working; it is deliberately not wired up until the
          Archivist has decided what it should show. */}
      {generation === 'couple' && (
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <IconAction variant="brown" label="More info (coming soon)" onClick={() => {}}>
            <InfoGlyph />
          </IconAction>
          {isAdmin && (
            <IconAction variant="brown" label="Edit (coming soon)" onClick={() => {}}>
              <PencilSquareIcon />
            </IconAction>
          )}
        </div>
      )}
    </div>
  )
}
