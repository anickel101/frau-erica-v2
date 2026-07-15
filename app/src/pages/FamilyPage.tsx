import ReactMarkdown from 'react-markdown'
import Layout from '../components/Layout'
import PersonCard from '../components/PersonCard'
import { sampleFamily } from '../data/mockFamily'
import { useHeaderRef } from '../hooks/useHeaderRef'

// Header image band -- capped at the same max width as the text content
// below. This matters once real photos are wired in: an unconstrained-width
// image would stretch past its natural resolution on wide screens. Falls
// back to a plain accent block if no header image exists for this family.
// Rendered as its own component (rather than inline in FamilyPage) because
// useHeaderRef() needs to be called from within Layout's children -- Layout
// renders HeaderRefContext.Provider around {children}, and FamilyPage itself
// is Layout's parent, not a descendant of that provider.
function FamilyHeader({ imageUrl }: { imageUrl: string | undefined }) {
  const headerRef = useHeaderRef()
  return (
    <div
      ref={headerRef}
      className="max-w-4xl h-64 sm:h-80 bg-fe-brown/20 flex items-center justify-center"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <p className="text-fe-ink/40 text-sm">No header image</p>
      )}
    </div>
  )
}

export default function FamilyPage() {
  // Phase 3C: replace sampleFamily with data fetched by family_id from
  // the route params, via the generated JSON / API.
  const family = sampleFamily

  return (
    <Layout>
      {/* Single padded wrapper for the whole content area (image + text),
          using the same p-6 (24px) as the sidebar's own padding -- this
          keeps top and left spacing in sync with the sidebar by
          construction, rather than as two separately-tuned values that
          can drift apart. */}
      <div className="p-6">
        <FamilyHeader imageUrl={family.header_image_url} />

        <div className="max-w-4xl mt-8">
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

          {/* Bottom accent bar -- 24px tall (matching the top bar) and
              width-matched to the header image/content column, NOT the
              full page width. Uses the same max-w-4xl as everything
              else above, so it stays in sync automatically. */}
          <div className="h-6 bg-fe-accent mt-8" />
        </div>
      </div>
    </Layout>
  )
}
