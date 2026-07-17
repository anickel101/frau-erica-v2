import { Navigate, useLocation } from 'react-router-dom'

// The approve-request form now lives on AdminUsersPage as a section, not
// its own page. Kept as a redirect (not deleted) rather than removing
// the route outright, so a Request Access notification email already
// sitting in an inbox (built by api/'s ses.ts before this change) still
// works -- preserves ?email=&name= so the prefill still happens on
// arrival. New emails link straight to /admin/users instead.
export default function AdminApprovePage() {
  const location = useLocation()
  return <Navigate to={`/admin/users${location.search}`} replace />
}
