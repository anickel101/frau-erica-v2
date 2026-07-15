import { Routes, Route } from 'react-router-dom'
import ContactPage from './pages/ContactPage'
import FamilyPage from './pages/FamilyPage'
import GalleriesPage from './pages/GalleriesPage'
import GalleryPage from './pages/GalleryPage'
import HomePage from './pages/HomePage'
import LexiconPage from './pages/LexiconPage'
import PersonsPage from './pages/PersonsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import TextPage from './pages/TextPage'
import TextsPage from './pages/TextsPage'
import UsersGuidePage from './pages/UsersGuidePage'

export default function App() {
  return (
    <Routes>
      {/* Signature page type -- built out first to validate the design system */}
      <Route path="/family/:id" element={<FamilyPage />} />

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
      <Route path="/persons" element={<PersonsPage />} />
      <Route path="/persons/:id" element={<PlaceholderPage title="Person" />} />
      <Route path="/login" element={<PlaceholderPage title="Log in" />} />
      <Route
        path="/request-access"
        element={<PlaceholderPage title="Request access" />}
      />
    </Routes>
  )
}
