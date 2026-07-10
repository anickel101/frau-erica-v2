import Layout from '../components/Layout'

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <Layout>
      <div className="px-4 sm:px-8 py-12 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-fe-ink/60 text-sm">
          Not built yet -- placeholder for Phase 3B.
        </p>
      </div>
    </Layout>
  )
}
