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
  const button =
    variant === 'danger'
      ? // bg-red-700, not a lighter red: white on red-700 clears WCAG AA
        // comfortably, matching the contrast standard the rest of the
        // site was brought up to.
        'bg-red-700 hover:bg-red-800 text-white'
      : 'text-fe-link hover:text-fe-link-dark'

  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`p-1.5 rounded-sm transition ${button}`}
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
