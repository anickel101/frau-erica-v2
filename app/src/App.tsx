import { Routes, Route } from 'react-router-dom'
import FamilyPage from './pages/FamilyPage'
import GalleriesPage from './pages/GalleriesPage'
import GalleryPage from './pages/GalleryPage'
import LexiconPage from './pages/LexiconPage'
import PersonsPage from './pages/PersonsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import TextPage from './pages/TextPage'
import TextsPage from './pages/TextsPage'

export default function App() {
  return (
    <Routes>
      {/* Signature page type -- built out first to validate the design system */}
      <Route path="/family/:id" element={<FamilyPage />} />

      {/* Public content -- Phase 3B */}
      <Route path="/" element={<PlaceholderPage title="Home" />} />
      <Route path="/documents" element={<TextsPage />} />
      <Route path="/documents/:id" element={<TextPage />} />
      <Route path="/galleries" element={<GalleriesPage />} />
      <Route path="/galleries/:id" element={<GalleryPage />} />
      <Route path="/lexicon" element={<LexiconPage />} />
      <Route path="/about" element={<PlaceholderPage title="User's guide" />} />
      <Route
        path="/contact"
        element={<PlaceholderPage title="Contact the archivist" />}
      />

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
