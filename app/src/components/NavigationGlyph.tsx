import { ReactNode } from 'react'

// The navigation glyphs shown on Family page boxes, and in the User's
// Guide legend that explains them.
//
// Shared rather than redrawn in the guide: a legend that quietly stops
// matching the thing it describes is worse than no legend, and these
// have already changed twice (colour, then outline, then size). One
// definition means the guide follows automatically.

// An SVG shape, not the Unicode ◆ character -- confirmed live (twice)
// that the plain-glyph approach doesn't reliably center: ◆'s rendered
// position within its own character cell varies by whatever font
// actually ends up supplying the glyph (Verdana has no diamond glyph,
// so this falls back to different system fonts on different
// browsers/OSes, each with different internal padding/baseline
// metrics), which no amount of CSS centering on the *container* can
// compensate for. An SVG polygon has an exact, deterministic bounding
// box regardless of font -- ▲/▼ stay plain Unicode since they've never
// had this problem.
// w-9 h-9. Sized to the triangles' rendered height rather than to a
// ratio of their font-size: at text-4xl (36px) a Unicode triangle's ink
// occupies roughly its full em box, so an SVG box of the same 36px puts
// the diamond's points level with the triangle's. The earlier w-6 (24px)
// came from a 2:3 ratio tuned by eye and left the diamond visibly
// smaller than the triangles it sits beside in the same column -- Opa
// asked for them to match.
//
// The polygon still spans the full 24-unit viewBox, so it scales with
// the box; only the rendered size changes.
//
// The stroke is the SVG half of the .glyph-outline utility (see
// index.css for why these glyphs are outlined at all) -- -webkit-text-stroke
// only applies to text, so the diamond has to carry its own. It is in
// viewBox units, so growing the box scales the outline with it: 2.5
// units across 36px renders ~1.9px, near enough the triangles' flat 2px
// that they still read as one family of shapes.
function DiamondGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-9 h-9" fill="currentColor" aria-hidden="true">
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
// generations, flex-centred so the SVG diamond centres on its own
// bounding box rather than on font-dependent glyph metrics.
export function GlyphSlot({ children }: { children: ReactNode }) {
  return (
    <span className="text-fe-accent glyph-outline text-4xl leading-none w-8 shrink-0 flex items-center justify-center">
      {children}
    </span>
  )
}

export { DiamondGlyph }
