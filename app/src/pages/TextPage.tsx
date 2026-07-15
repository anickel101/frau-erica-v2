import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import TextByline from '../components/TextByline'
import { mockTexts } from '../data/mockTexts'
import { getAuthorPerson } from '../utils/textDisplay'

export default function TextPage() {
  const { id } = useParams<{ id: string }>()
  const document = mockTexts.find((d) => d.document_id === Number(id)) ?? mockTexts[0]
  const authorPerson = getAuthorPerson(document)

  const seriesChapters = document.series_key
    ? mockTexts
        .filter((d) => d.series_key === document.series_key)
        .sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0))
    : []

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        {document.series_title && (
          <p className="text-sm text-fe-brown mb-1">{document.series_title}</p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{document.title}</h1>
        <p className="text-sm text-fe-ink/70 mb-4">
          <TextByline
            author={document.author}
            authorPerson={authorPerson}
            genre={document.genre}
          />
        </p>

        {document.summary && (
          <div className="prose prose-sm max-w-none mb-6 text-fe-ink/90">
            <ReactMarkdown>{document.summary}</ReactMarkdown>
          </div>
        )}

        <div className="prose prose-sm max-w-none text-fe-ink/90">
          <ReactMarkdown>{document.content}</ReactMarkdown>
        </div>

        {seriesChapters.length > 0 && (
          <div className="mt-8">
            <h2 className="font-bold text-sm text-fe-brown mb-2">
              Chapters in this series
            </h2>
            <ol className="space-y-1 text-sm">
              {seriesChapters.map((chapter) =>
                chapter.document_id === document.document_id ? (
                  <li key={chapter.document_id} className="font-bold">
                    {chapter.series_order}. {chapter.title}
                  </li>
                ) : (
                  <li key={chapter.document_id}>
                    <Link
                      to={`/documents/${chapter.document_id}`}
                      className="text-fe-accent hover:text-fe-accent-dark"
                    >
                      {chapter.series_order}. {chapter.title}
                    </Link>
                  </li>
                ),
              )}
            </ol>
          </div>
        )}
      </div>
    </Layout>
  )
}
