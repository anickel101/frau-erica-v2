// Shared Tailwind classes for form controls used across LoginForm,
// RequestAccessPage, AdminApprovePage, AdminUsersPage, and PersonPicker
// -- kept in one place so a class changing in one copy can't silently
// drift from the others (it already had: AdminUsersPage's button was a
// step smaller than everyone else's for no real reason).
export const inputClassName =
  'w-full px-3 py-2 border border-fe-brown/40 rounded-sm bg-white text-sm focus:outline-none focus:border-fe-accent'

// fe-link, not fe-accent, for the fill. White on the brand orange is
// 2.94:1 and on accent-dark 4.40:1; this text is 14px bold, which is not
// WCAG "large" (that starts at 18.66px bold), so it wants 4.5:1. The link
// shades give 5.50:1 and 7.63:1 and are the same orange, a shade down --
// see index.css, where these two tokens are defined and measured.
//
// The brand value is untouched; it still owns the bars and the glyphs.
// Only the surfaces carrying small white text move.
export const buttonClassName =
  'bg-fe-link hover:bg-fe-link-dark text-white px-4 py-2 rounded-sm text-sm font-bold disabled:opacity-50'

// The same control rendered as a react-router <Link>: the gate screens'
// "Log in" and "Request access". `inline-block` because an <a> is inline
// by default and would ignore the vertical padding.
//
// Derived rather than retyped. Four files had pasted copies of the string
// above, so the contrast fix would have corrected the shared button and
// left every gate screen -- the actual first thing a locked-out relative
// sees -- still failing. That is exactly the drift this module exists to
// prevent, and it had already happened.
export const linkButtonClassName = `${buttonClassName} inline-block`
