import { Link } from 'react-router-dom'
import { PencilSquareIcon } from '@heroicons/react/24/outline'
import IconAction from './IconAction'
import { AltFamilyChevron, DiamondGlyph, GlyphSlot } from './NavigationGlyph'
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
}) {
  const { groups } = useAuth()
  const isAdmin = groups.includes('admin')

  const name = getFullName(person)

  // The couple's boxes are the page you're on, so they go nowhere: no
  // link, no hover, no cursor. A partner with another marriage gets a
  // separate chevron beside the box (see AltFamilyChevron), and that
  // chevron -- not the box -- is the link. Grandparent and child boxes
  // navigate to that person's own family page.
  const isCouple = generation === 'couple'
  const hasOtherFamily = isCouple && person.otherFamilyId != null
  const to =
    person.linkedFamilyId !== null
      ? `/family/${person.linkedFamilyId}`
      : `/persons/${person.person_id}`

  const box = (
    <div
      className={`
        relative flex items-center gap-3 p-4 rounded-sm
        ${GENERATION_STYLES[generation]} ${GENERATION_BORDER[generation]}
      `}
    >
      {/* A "stretched" link: absolutely covers the whole box so the
          entire face is clickable. The hover is drawn on the link, not
          the box. */}
      {!isCouple && (
        <Link
          to={to}
          aria-label={`${name}'s family page`}
          className="absolute inset-0 rounded-sm transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fe-accent"
        />
      )}

      {/* The left column is the glyph slot on grandparent and child
          boxes, and the icon stack on couple boxes. Both are 32px wide,
          so every name on the page starts 62px in from its box's left
          edge (border 2 + p-4 16 + 32 + gap-3 12), and the summary
          paragraph above the tree is indented to match. A couple box
          never shows a diamond (FamilyPage passes isInGermline={false}
          for the couple, deliberately -- see its comment there), so the
          slot is free for the icons.

          Neither icon does anything yet; both are present so the layout
          is settled before there is something behind them. The info
          dialog is built (PersonInfoDialog.tsx) and was working; it is
          deliberately not wired up until the Archivist has decided what
          it should show. */}
      {isCouple ? (
        <div className="flex w-8 shrink-0 flex-col items-center gap-1">
          <IconAction
            variant="brown"
            tooltip="left"
            label="More info (coming soon)"
            onClick={() => {}}
          >
            <InfoGlyph />
          </IconAction>
          {isAdmin && (
            <IconAction
              variant="brown"
              tooltip="left"
              label="Edit (coming soon)"
              onClick={() => {}}
            >
              <PencilSquareIcon />
            </IconAction>
          )}
        </div>
      ) : (
        <GlyphSlot>{isInGermline && <DiamondGlyph />}</GlyphSlot>
      )}

      {/* pointer-events-none so a click on the name reaches the
          stretched link underneath rather than landing on the <p> and
          going nowhere. The name is the most obvious thing to click. */}
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
    </div>
  )

  if (!hasOtherFamily) return box

  // Box, gap, chevron. The chevron stretches to the box's height and is
  // the only clickable part of the pair.
  return (
    <div className="flex items-stretch gap-2">
      <div className="min-w-0 flex-1">{box}</div>
      <AltFamilyChevron
        to={`/family/${person.otherFamilyId}`}
        label={`${person.first_name}'s other marriage`}
      />
    </div>
  )
}
