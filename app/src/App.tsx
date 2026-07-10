import { Routes, Route } from 'react-router-dom'
import FamilyPage from './pages/FamilyPage'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
  return (
    <Routes>
      {/* Signature page type -- built out first to validate the design system */}
      <Route path="/family/:id" element={<FamilyPage />} />

      {/* Public content -- Phase 3B */}
      <Route path="/" element={<PlaceholderPage title="Home" />} />
      <Route path="/documents" element={<PlaceholderPage title="Index of texts" />} />
      <Route path="/documents/:id" element={<PlaceholderPage title="Document" />} />
      <Route path="/galleries" element={<PlaceholderPage title="Photo galleries" />} />
      <Route path="/galleries/:id" element={<PlaceholderPage title="Gallery" />} />
      <Route path="/lexicon" element={<PlaceholderPage title="The Mueller Lexicon" />} />
      <Route path="/about" element={<PlaceholderPage title="User's guide" />} />
      <Route path="/contact" element={<PlaceholderPage title="Contact the archivist" />} />

      {/* Gated -- Phase 3D/3E */}
      <Route path="/persons" element={<PlaceholderPage title="Index of persons" />} />
      <Route path="/persons/:id" element={<PlaceholderPage title="Person" />} />
      <Route path="/login" element={<PlaceholderPage title="Log in" />} />
      <Route path="/request-access" element={<PlaceholderPage title="Request access" />} />
    </Routes>
  )
}
