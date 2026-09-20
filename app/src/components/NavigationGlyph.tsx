import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// The navigation glyphs shown on Family page boxes, and in the User's
// Guide legend that explains them.
//
// Shared rather than redrawn in the guide: a legend that quietly stops
// matching the thing it describes is worse than no legend, and these
// have already changed several times (color, outline, size, and now the
// removal of the triangles). One definition means the guide follows
// automatically.

// An SVG shape, not the Unicode ◆ character -- confirmed live (twice)
// that the plain-glyph approach doesn't reliably center: ◆'s rendered
// position within its own character cell varies by whatever font
// actually ends up supplying the glyph (Verdana has no diamond glyph,
// so this falls back to different system fonts on different
// browsers/OSes, each with different internal padding/baseline
// metrics), which no amount of CSS centering on the *container* can
// compensate for. An SVG polygon has an exact, deterministic bounding
// box regardless of font.
//
// 0.78em: sized so its ink matched the triangles' ink back when both
// shared a slot. The triangles are gone from the boxes now, but the
// slot keeps the same font-size, so the diamond stays the size the
// Archivist approved.
//
// The stroke is the SVG half of the .glyph-outline utility (see
// index.css for why these glyphs are outlined at all) -- -webkit-text-stroke
// only applies to text, so the diamond has to carry its own.
function DiamondGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[0.78em] h-[0.78em]"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon
        points="12,2 22,12 12,22 2,12"
        stroke="var(--color-fe-brown)"
        strokeWidth="2.5"
        paintOrder="stroke"
      />
    </svg>
  )
}

// The canonical wrapper: fixed-width so names line up across all three
// generations, flex-centered so the SVG diamond centers on its own
// bounding box rather than on font-dependent glyph metrics.
//
// Still rendered on every box, even though only a germline diamond ever
// fills it now. The slot is what keeps the name text at the same
// x-position on every box on the page, and the summary paragraph above
// the tree is indented to match it -- removing the slot from boxes that
// have nothing to show would let their names creep left of their
// neighbours'.
export function GlyphSlot({ children }: { children: ReactNode }) {
  return (
    <span className="text-fe-accent glyph-outline text-4xl leading-none w-8 shrink-0 flex items-center justify-center">
      {children}
    </span>
  )
}

// The link to a person's other marriage: a chevron beside their box, in
// the box's own colour and border, pointing away from it. The box's
// adjacent edge is pointed to the same depth (see PersonCard), so the
// two nest like breadcrumb arrows rather than sitting as two objects.
//
// Geometry, all in px, all load-bearing for the name alignment:
//   width 40; point and notch both 18 deep (CHEVRON_POINT); the box
//   overlaps the chevron by 14 so its own 18px point sits 4px inside
//   the notch. Box edge therefore lands at 40 - 14 + 18 = 44 from the
//   column's start, and 44 + 18px padding puts the name at 62 -- the
//   same x as every other name on the page.
//
// Stretched to the box's full height with preserveAspectRatio="none";
// vector-effect keeps the stroke at a constant 2px so it matches the
// box's own 2px outline whatever the box's height.
export const CHEVRON_WIDTH = 40
export const CHEVRON_POINT = 18
export const CHEVRON_OVERLAP = 14

export function AltFamilyChevron({
  to,
  direction,
  label,
}: {
  to: string
  direction: 'left' | 'right'
  label: string
}) {
  const w = CHEVRON_WIDTH
  const d = CHEVRON_POINT
  const points =
    direction === 'right'
      ? `${w - d},0 0,0 ${d},30 0,60 ${w - d},60 ${w},30`
      : `${d},0 ${w},0 ${w - d},30 ${w},60 ${d},60 0,30`
  return (
    <Link
      to={to}
      aria-label={label}
      style={{ width: w }}
      className="group/chevron block shrink-0 self-stretch outline-none focus-visible:ring-2 focus-visible:ring-fe-accent rounded-sm"
    >
      <svg
        viewBox={`0 0 ${w} 60`}
        preserveAspectRatio="none"
        className="h-full w-full fill-fe-gen-couple group-hover/chevron:fill-fe-gen-couple-dark transition"
        aria-hidden="true"
      >
        <polygon
          points={points}
          stroke="var(--color-fe-gen-couple-dark)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  )
}

// A static rendering of the chevron for the User's Guide legend --
// same shape, same colours, not a link.
export function AltFamilyChevronGlyph() {
  return (
    <svg
      viewBox="0 0 40 60"
      className="h-7 w-[18px] fill-fe-gen-couple"
      aria-hidden="true"
    >
      <polygon
        points="22,0 0,0 18,30 0,60 22,60 40,30"
        stroke="var(--color-fe-gen-couple-dark)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export { DiamondGlyph }
