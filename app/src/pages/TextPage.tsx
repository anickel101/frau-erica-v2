import { type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { type ExtraProps } from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import DocumentEmbeddedImage from '../components/DocumentEmbeddedImage'
import Layout from '../components/Layout'
import TextByline from '../components/TextByline'
import { getDocumentById, getSeriesChapters } from '../data-access/public/documents'
import { getAuthorPerson } from '../utils/textDisplay'

// Renders every embedded <img> (from {{image:ID}} shortcodes, resolved
// to markdown image syntax -- see data-access/public/documents.ts) via
// DocumentEmbeddedImage instead of a bare <img> -- floats it so text
// wraps around it, and gets the zoom-on-click modal.
const IMAGE_COMPONENTS = {
  img: ({ src, alt }: ComponentPropsWithoutRef<'img'> & ExtraProps) => (
    <DocumentEmbeddedImage src={src} alt={alt} />
  ),
  // Markdown always wraps a bare `![]()` on its own line in a <p> -- but
  // DocumentEmbeddedImage renders a block-level <figure> (with a
  // <figcaption>), which is invalid HTML nested inside a <p> (confirmed
  // live: a real hydration warning, not just a lint nitpick). When a
  // paragraph's only content is a single image, render it unwrapped.
  // Every other paragraph gets mb-4 -- Tailwind's preflight zeroes out
  // <p>'s default browser margin, so without this every paragraph ran
  // directly into the next with no visual break at all.
  p: ({ children, node }: ComponentPropsWithoutRef<'p'> & ExtraProps) => {
    const onlyChild = node?.children.length === 1 ? node.children[0] : undefined
    const isSoloImage = onlyChild?.type === 'element' && onlyChild.tagName === 'img'
    return isSoloImage ? <>{children}</> : <p className="mb-4">{children}</p>
  },
}

export default function TextPage() {
  const { id } = useParams<{ id: string }>()
  const document = getDocumentById(Number(id))

  if (!document) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl">
          <p className="text-fe-ink/60 text-sm">
            Text not found.{' '}
            <Link to="/documents" className="text-fe-accent hover:text-fe-accent-dark">
              Back to Index of Texts
            </Link>
          </p>
        </div>
      </Layout>
    )
  }

  const authorPerson = getAuthorPerson(document)
  const seriesChapters = document.series_key ? getSeriesChapters(document.series_key) : []

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
          // flow-root -- not overflow-hidden -- contains the floated
          // DocumentEmbeddedImage figures without clipping anything,
          // so this div's own height still includes a trailing image
          // taller than the text next to it.
          <div className="max-w-none mb-6 text-[12px] text-fe-ink flow-root">
            <ReactMarkdown components={IMAGE_COMPONENTS}>
              {document.summary}
            </ReactMarkdown>
          </div>
        )}

        <div className="max-w-none text-[12px] text-fe-ink flow-root">
          <ReactMarkdown components={IMAGE_COMPONENTS}>{document.content}</ReactMarkdown>
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
