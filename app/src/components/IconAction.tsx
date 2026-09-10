import { ReactNode } from 'react'

// An icon-only action button with a tooltip.
//
// Icon-only controls carry a real risk: the label disappears. So the
// accessible name comes from aria-label, which screen readers and
// keyboard users get regardless -- the tooltip is the *visual* affordance
// on top of that, not the mechanism. The tooltip itself is aria-hidden so
// assistive tech reads the name once, not twice.
//
// Shown on focus as well as hover. A hover-only tooltip is invisible to
// anyone driving the page from the keyboard, which on a page whose
// actions include "delete this account" is not a detail.
//
// Not the native `title` attribute: it waits about a second before
// appearing, can't be styled to match anything, and is announced
// inconsistently across screen readers.
export default function IconAction({
  label,
  onClick,
  children,
  variant = 'plain',
}: {
  label: string
  onClick: () => void
  children: ReactNode
  // 'danger' is the filled red treatment -- reserved for destructive
  // actions, so the one button that deletes an account doesn't look like
  // the two that don't.
  variant?: 'plain' | 'danger'
}) {
  // All three are circles, so the row reads as one set of controls
  // rather than two plain glyphs beside a filled block.
  //
  // The plain ring is border-current, so it takes whatever colour the
  // icon has and follows it on hover without a second colour to keep in
  // sync. 1.5px matches the icons' own stroke-width exactly (Heroicons
  // 24/outline draws at 1.5), so the ring reads as part of the same
  // drawing rather than a box around it.
  const button =
    variant === 'danger'
      ? // bg-red-700, not a lighter red: white on red-700 clears WCAG AA
        // comfortably, matching the contrast standard the rest of the
        // site was brought up to.
        // A transparent ring of the same width as the plain variant's,
        // so the filled circle is the same overall size as the outlined
        // ones. Without it the border sits outside the 32px box and the
        // two ringed buttons render 34px while the red one stays 32,
        // which reads as the red circle being slightly small.
        'bg-red-700 hover:bg-red-800 text-white border-[1.5px] border-transparent'
      : 'text-fe-link hover:text-fe-link-dark border-[1.5px] border-current'

  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        // A fixed 30x30 box rather than padding around the icon: the
        // border sits outside the padding box, so a padding-derived size
        // lands on awkward numbers and drifts if the icon size changes.
        // The icon is sized here too ([&>svg]) so the component owns its
        // whole size contract and a fifth action can't quietly arrive at
        // a different scale.
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-full transition [&>svg]:h-4 [&>svg]:w-4 ${button}`}
      >
        {children}
      </button>
      {/* `hidden`, not `opacity-0`. An invisible-but-laid-out tooltip
          still occupies space, and a nowrap label roughly three times the
          width of its button pushed the whole page into horizontal scroll
          on narrow screens -- while showing nothing at all. display:none
          costs the fade, which is a fair trade for a page that doesn't
          scroll sideways.

          Anchored right, not centred: these sit in the last column, so a
          centred tooltip grows off the edge of the page. Growing leftward
          keeps it over the table, where there's always room.

          Above the button rather than below, so the last row's tooltip
          doesn't extend past the end of the page. pointer-events-none so
          it can never sit between the cursor and the button it
          describes. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-1 hidden whitespace-nowrap rounded-sm bg-fe-ink px-2 py-1 text-xs text-white group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  )
}
