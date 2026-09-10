import { ReactNode } from 'react'

// The navigation glyphs shown on Family page boxes, and in the User's
// Guide legend that explains them.
//
// Shared rather than redrawn in the guide: a legend that quietly stops
// matching the thing it describes is worse than no legend, and these
// have already changed twice (color, then outline, then size). One
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
// Sized in em, not px, so the diamond tracks the triangles beside it at
// whatever font-size the slot happens to use.
//
// 0.83em because the diamond's *ink* has to match the triangles' ink,
// not their font-size. A 36px triangle glyph draws about 28px of actual
// shape; the SVG's polygon spans 20 of 24 viewBox units and its 2.5-unit
// stroke extends half its width beyond that (paint-order controls draw
// order, not geometry), so the ink is very nearly the full box -- which
// makes 28/36 the ratio that puts them level. Measured from rendered pixels -- glyph ink can't be
// derived from the font size.
//
// The stroke is the SVG half of the .glyph-outline utility (see
// index.css for why these glyphs are outlined at all) -- -webkit-text-stroke
// only applies to text, so the diamond has to carry its own. It is in
// viewBox units, so growing the box scales the outline with it: 2.5
// units across 36px renders ~1.9px, near enough the triangles' flat 2px
// that they still read as one family of shapes.
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
export function GlyphSlot({ children }: { children: ReactNode }) {
  return (
    <span className="text-fe-accent glyph-outline text-4xl leading-none w-8 shrink-0 flex items-center justify-center">
      {children}
    </span>
  )
}

// The sideways marker, for a person's other marriage.
//
// A rotated ▲ rather than the Unicode ▶ (U+25B6). They are different
// glyphs, not one shape at two angles: ▶ renders 29x33 where ▲ renders
// 28x28, so beside each other the sideways one read as a taller, heavier
// mark. Rotating the same character guarantees the same shape, the same
// stroke, and the same ink, at any size.
//
// inline-block because `rotate` has no effect on an inline element.
export function SidewaysGlyph() {
  return <span className="inline-block rotate-90">▲</span>
}

export { DiamondGlyph }
