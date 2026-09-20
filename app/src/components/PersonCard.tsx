import { useState } from 'react'
import { Link } from 'react-router-dom'
import { InformationCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { AltFamilyChevron, DiamondGlyph, GlyphSlot } from './NavigationGlyph'
import PersonInfoDialog from './PersonInfoDialog'
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

// Shared by the two icon buttons so they can't drift apart. Plain
// glyphs rather than IconAction's ringed circles: inside a coloured box
// a ring reads as a second box, and the hover colour change plus the
// cursor is enough to say "interactive" here.
const ICON_BUTTON =
  'flex h-7 w-7 items-center justify-center rounded-full text-fe-brown transition ' +
  'hover:bg-black/10 hover:text-fe-ink cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fe-accent'

export default function PersonCard({
  person,
  generation,
  isInGermline = false,
  side,
  currentFamilyId = null,
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
  // The family page this card is rendered on, passed through to the
  // info dialog so it doesn't offer a link back to the page the reader
  // is already looking at.
  currentFamilyId?: number | null
}) {
  const { groups } = useAuth()
  const isAdmin = groups.includes('admin')
  const [infoOpen, setInfoOpen] = useState(false)

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
      <div className="flex items-stretch gap-2">
        {chevronOnLeft && chevron}

        <div
          className={`
            relative flex flex-1 items-center gap-3 p-4 rounded-sm
            ${GENERATION_STYLES[generation]} ${GENERATION_BORDER[generation]}
          `}
        >
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

          <div className="min-w-0">
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

          {/* The icons take whatever room is left after the name and
              centre themselves in it, so they sit midway between the end
              of the text and the box's edge however long the name is. */}
          <div className="relative z-10 flex flex-1 items-center justify-center gap-1.5 self-stretch">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              aria-label={`More about ${name}`}
              title="More info"
              className={ICON_BUTTON}
            >
              <InformationCircleIcon className="h-5 w-5" />
            </button>
            {isAdmin && (
              // Rendered for admins only, and not wired to anything yet
              // -- editing is later work. Present now so the layout is
              // settled with two icons before there's a second thing to
              // build behind it.
              <button
                type="button"
                aria-label={`Edit ${name} (not yet available)`}
                title="Edit (coming soon)"
                className={ICON_BUTTON}
              >
                <PencilSquareIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {!chevronOnLeft && chevron}
      </div>

      <PersonInfoDialog
        person={person}
        currentFamilyId={currentFamilyId}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </>
  )
}
