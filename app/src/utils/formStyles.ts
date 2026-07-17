// Shared Tailwind classes for form controls used across LoginForm,
// RequestAccessPage, AdminApprovePage, AdminUsersPage, and PersonPicker
// -- kept in one place so a class changing in one copy can't silently
// drift from the others (it already had: AdminUsersPage's button was a
// step smaller than everyone else's for no real reason).
export const inputClassName =
  'w-full px-3 py-2 border border-fe-brown/40 rounded-sm bg-white text-sm focus:outline-none focus:border-fe-accent'

export const buttonClassName =
  'bg-fe-accent hover:bg-fe-accent-dark text-white px-4 py-2 rounded-sm text-sm font-bold disabled:opacity-50'

// Compact variant for inline/in-table actions (AdminUsersPage's
// Save/Cancel row) where the full-size button would be too large.
export const compactButtonClassName =
  'bg-fe-accent hover:bg-fe-accent-dark text-white px-3 py-1.5 rounded-sm text-sm font-bold disabled:opacity-50'
