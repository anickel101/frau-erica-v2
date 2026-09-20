import { ReactNode } from 'react'

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

// How deep a couple box's point is, when it has one. The box itself
// becomes the arrow: a partner with another marriage gets their box
// pointed on their own side, and the whole shape links there. About
// half the box's height, so the tip is near a right angle.
export const BOX_POINT = 30

// The legend's picture of that pointed box -- same proportions, same
// colours, not a link.
export function PointedBoxGlyph() {
  return (
    <svg viewBox="0 0 60 30" className="h-6 w-12" aria-hidden="true">
      <polygon
        points="1,1 44,1 59,15 44,29 1,29"
        fill="var(--color-fe-gen-couple)"
        stroke="var(--color-fe-gen-couple-dark)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export { DiamondGlyph }
