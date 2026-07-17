import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import RequireAdmin from './components/RequireAdmin'
import RequireApproved from './components/RequireApproved'

// Route-level code splitting -- a public visitor loading HomePage
// previously downloaded every page's JS up front, including the Cognito
// SDK and admin-only screens they'll likely never open. Layout/Sidebar
// and the Require* gates stay eager (small, needed on every route).
const AdminApprovePage = lazy(() => import('./pages/AdminApprovePage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const FamilyPage = lazy(() => import('./pages/FamilyPage'))
const GalleriesPage = lazy(() => import('./pages/GalleriesPage'))
const GalleryPage = lazy(() => import('./pages/GalleryPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const LexiconPage = lazy(() => import('./pages/LexiconPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const PersonsPage = lazy(() => import('./pages/PersonsPage'))
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'))
const RequestAccessPage = lazy(() => import('./pages/RequestAccessPage'))
const TextPage = lazy(() => import('./pages/TextPage'))
const TextsPage = lazy(() => import('./pages/TextsPage'))
const UsersGuidePage = lazy(() => import('./pages/UsersGuidePage'))

function RouteLoading() {
  return (
    <div className="p-6">
      <p className="text-fe-ink/60 text-sm">Loading...</p>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* Signature page type -- built out first to validate the design system */}
        <Route
          path="/family/:id"
          element={
            <RequireApproved>
              <FamilyPage />
            </RequireApproved>
          }
        />

        {/* Public content -- Phase 3B */}
        <Route path="/" element={<HomePage />} />
        <Route path="/documents" element={<TextsPage />} />
        <Route path="/documents/:id" element={<TextPage />} />
        <Route path="/galleries" element={<GalleriesPage />} />
        <Route path="/galleries/:id" element={<GalleryPage />} />
        <Route path="/lexicon" element={<LexiconPage />} />
        <Route path="/about" element={<UsersGuidePage />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* Gated -- Phase 3D/3E */}
        <Route
          path="/persons"
          element={
            <RequireApproved>
              <PersonsPage />
            </RequireApproved>
          }
        />
        <Route
          path="/persons/:id"
          element={
            <RequireApproved>
              <PlaceholderPage title="Person" />
            </RequireApproved>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/request-access" element={<RequestAccessPage />} />

        {/* Admin only */}
        <Route
          path="/admin/approve"
          element={
            <RequireAdmin>
              <AdminApprovePage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <AdminUsersPage />
            </RequireAdmin>
          }
        />
      </Routes>
    </Suspense>
  )
}
