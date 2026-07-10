import ReactMarkdown from 'react-markdown'
import Layout from '../components/Layout'
import PersonCard from '../components/PersonCard'
import { sampleFamily } from '../data/mockFamily'

export default function FamilyPage() {
  // Phase 3C: replace sampleFamily with data fetched by family_id from
  // the route params, via the generated JSON / API.
  const family = sampleFamily

  return (
    <Layout>
      {/* Top accent bar */}
      <div className="h-2 bg-fe-accent" />

      {/* Header image band -- falls back to a plain accent block if no
          header image exists for this family */}
      <div className="w-full h-64 sm:h-80 bg-fe-brown/20 flex items-center justify-center">
        {family.header_image_url ? (
          <img
            src={family.header_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <p className="text-fe-ink/40 text-sm">No hello header image</p>
        )}
      </div>

      <div className="px-4 sm:px-8 py-8 max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">
          {family.person_1.first_name} {family.person_1.last_name} and{' '}
          {family.person_2.first_name} {family.person_2.last_name}
        </h1>

        <div className="prose prose-sm max-w-none mb-8 text-fe-ink/90">
          <ReactMarkdown>{family.description}</ReactMarkdown>
        </div>

        {/* Grandparents: two columns, one per side of the couple */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {family.grandparents_1.map((p) => (
            <PersonCard key={p.person_id} person={p} generation="grandparent" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {family.grandparents_2.map((p) => (
            <PersonCard key={p.person_id} person={p} generation="grandparent" />
          ))}
        </div>

        {/* The featured couple */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <PersonCard person={family.person_1} generation="couple" />
          <PersonCard person={family.person_2} generation="couple" />
        </div>

        {/* Children, if any */}
        {family.children.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {family.children.map((p) => (
              <PersonCard key={p.person_id} person={p} generation="child" />
            ))}
          </div>
        )}
      </div>

      <div className="h-2 bg-fe-accent" />
    </Layout>
  )
}
