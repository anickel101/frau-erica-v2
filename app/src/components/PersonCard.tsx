import { Link } from 'react-router-dom'
import { InformationCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import IconAction from './IconAction'
import {
  AltFamilyChevron,
  CHEVRON_OVERLAP,
  CHEVRON_POINT,
  DiamondGlyph,
  GlyphSlot,
} from './NavigationGlyph'
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

  // The couple's boxes are the page you're on. Clicking them went
  // nowhere useful, so they are no longer links at all -- no hover, no
  // cursor. Grandparent and child boxes still navigate to that person's
  // own family page.
  const isNavigable = generation !== 'couple'
  const to =
    person.linkedFamilyId !== null
      ? `/family/${person.linkedFamilyId}`
      : `/persons/${person.person_id}`

  const hasOtherFamily = generation === 'couple' && person.otherFamilyId != null
  // A left-hand chevron stands exactly where the glyph slot would: its
  // width plus the gap beside it (36 + 8) equals the slot plus its gap
  // (32 + 12), so a box with a chevron on its left drops the slot and
  // its name lands at the same x as every other name on the page. 41
  // families have their alternate marriage on the left partner, so this
  // is the common case, not the edge case -- an earlier build let the
  // chevron push the whole box over, and Ernst Rickmeyer's name sat
  // 175px right of his father's directly above it.
  const chevronOnLeft = hasOtherFamily && side === 'left'
  const chevronOnRight = hasOtherFamily && side !== 'left'

  // A box beside a chevron has its adjacent edge pointed to the same
  // depth, so the two nest. clip-path draws the point but also clips
  // away any CSS border, so a pointed box is built as two stacked
  // layers -- the border colour clipped to the full shape, the fill
  // clipped to the same shape inset by 2px -- with the content above.
  // The inset diagonal runs a hair thinner than 2px (about 1.7 at this
  // angle), which is below what the eye picks up beside the chevron's
  // true 2px stroke.
  //
  // Padding on the pointed side is the point plus the normal 18px
  // (border 2 + p-4 16 everywhere else), and the box overlaps the
  // chevron by CHEVRON_OVERLAP. Together with the chevron's own width
  // that puts the name at exactly the x every other name uses -- see
  // AltFamilyChevron for the arithmetic.
  const pointed = chevronOnLeft || chevronOnRight
  const d = CHEVRON_POINT
  const clipPath = pointed
    ? `polygon(${chevronOnLeft ? `${d}px` : '0'} 0, ${chevronOnRight ? `calc(100% - ${d}px)` : '100%'} 0, ` +
      `${chevronOnRight ? `100% 50%, calc(100% - ${d}px) 100%` : '100% 100%'}, ` +
      `${chevronOnLeft ? `${d}px 100%, 0 50%` : '0 100%'})`
    : undefined
  const chevron = hasOtherFamily && (
    <AltFamilyChevron
      to={`/family/${person.otherFamilyId}`}
      direction={side === 'left' ? 'left' : 'right'}
      label={`${person.first_name}'s other family`}
    />
  )

  return (
    <>
      {/* The chevron is a sibling of the box, not part of it, so the box
          keeps its own border all the way round and the chevron carries
          its own. It sits on whichever side its partner is on. */}
      <div className="flex items-stretch">
        {chevronOnLeft && chevron}

        <div
          style={{
            marginLeft: chevronOnLeft ? -CHEVRON_OVERLAP : undefined,
            marginRight: chevronOnRight ? -CHEVRON_OVERLAP : undefined,
            paddingLeft: chevronOnLeft ? d + 18 : undefined,
            paddingRight: chevronOnRight ? d + 18 : undefined,
          }}
          className={`
            relative flex flex-1 items-center gap-3
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
              entire face is clickable, as before -- but as a SIBLING of
              the icon buttons rather than their parent, because a
              <button> inside an <a> is invalid HTML and unreachable to
              assistive tech. The buttons sit above it (z-10), so they
              take their own clicks. The hover is drawn on the link, not
              the box, so hovering a button doesn't dim the whole face. */}
          {isNavigable && (
            <Link
              to={to}
              aria-label={`${name}'s family page`}
              className="absolute inset-0 rounded-sm transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fe-accent"
            />
          )}

          {!chevronOnLeft && <GlyphSlot>{isInGermline && <DiamondGlyph />}</GlyphSlot>}

          <div className="relative min-w-0">
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

          {/* Couple boxes only. The grandparent and child boxes are
              links -- their whole face goes somewhere -- and a second
              control on a surface that is already a control reads as
              clutter. The couple's boxes go nowhere, so the icons are
              the only thing to do there, and the space beside the name
              is theirs.

              The icons take whatever room is left after the name and
              centre themselves in it, so they sit midway between the end
              of the text and the box's edge however long the name is. */}
          {generation === 'couple' && (
            <div className="relative z-10 flex flex-1 items-center justify-center gap-2 self-stretch">
              {/* Neither icon does anything yet. Both are present so the
                  layout is settled before there is something behind
                  them. The info dialog is built (PersonInfoDialog.tsx)
                  and was working; it is deliberately not wired up until
                  the Archivist has decided what it should show.

                  IconAction, the same 30px ringed circle the Manage
                  Users page uses, so an icon button is one thing across
                  the site. A first draft used bare 20px glyphs here and
                  they read as smaller than the admin page's, even though
                  the glyph itself was larger: the ring is what gives the
                  control its presence. */}
              <IconAction label="More info (coming soon)" onClick={() => {}}>
                <InformationCircleIcon />
              </IconAction>
              {isAdmin && (
                <IconAction label="Edit (coming soon)" onClick={() => {}}>
                  <PencilSquareIcon />
                </IconAction>
              )}
            </div>
          )}
        </div>

        {chevronOnRight && chevron}
      </div>
    </>
  )
}
