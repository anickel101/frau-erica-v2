import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import HeaderPhoto from '../components/HeaderPhoto'
import InlineMarkdown from '../components/InlineMarkdown'
import TextBody from '../components/TextBody'
import TextByline from '../components/TextByline'
import Layout from '../components/Layout'
import { getSeriesChapters } from '../data-access/public/documents'
import {
  getDocumentById,
  resolveImagePlaceholders,
} from '../data-access/public/documentDetail'
import { useAuth } from '../hooks/useAuth'
import { useStagedText, type StagedText } from '../hooks/useStagedText'
import { displayKicker, getDocumentAuthors } from '../utils/textDisplay'
import { resolveImageUrl } from '../utils/imageUrl'

// Same shape and reasoning as FamilyPage's FamilyHeader: useHeaderRef()
// has to be called from inside Layout's children, so this can't be
// inlined into TextPage, which is Layout's parent. Keeps the sidebar's
// logo-block divider aligned with the bottom of the photo.
//
// Text pages had no header image at all until Opa asked for one ("ensure
// that every text file has a header image, I think all Family pages
// do"). The caption sits below at the same size as the document's own
// image captions.
function TextHeader({ imageUrl, caption }: { imageUrl: string; caption: string | null }) {
  return (
    <>
      <HeaderPhoto src={imageUrl} />
      {/* text-balance for the same reason gallery captions have it: a
          two-line caption otherwise fills the first line and leaves a
          stub on the second. The Family page's own header caption
          already solved this with text-pretty and a width search (see
          FamilyCaption there); this one had nothing. */}
      {/* Flush right under the image, and held to three quarters of its
          width, so a long caption breaks into several short lines
          instead of running the full span of the photograph. Both at
          the archivist's request. The treatment starts at sm: on a
          phone three quarters of an already narrow column would set the
          caption in a ribbon, so there it stays full width and ranged
          left, as it was. */}
      {caption && (
        <div className="max-w-4xl mt-2">
          <p className="text-[11px] leading-tight text-fe-ink/60 text-balance sm:ml-auto sm:w-3/4 sm:text-right">
            <InlineMarkdown>{caption}</InlineMarkdown>
          </p>
        </div>
      )}
    </>
  )
}

export default function TextPage() {
  const { id } = useParams<{ id: string }>()
  const document = getDocumentById(Number(id))
  const { status, groups } = useAuth()
  const isAdmin = status === 'signedIn' && groups.includes('admin')
  const staged = useStagedText(document?.document_id ?? null, isAdmin)
  const [showStaged, setShowStaged] = useState(true)

  if (!document) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl">
          <p className="text-fe-ink/60 text-sm">
            Text not found.{' '}
            <Link to="/documents" className="text-fe-link hover:text-fe-link-dark">
              Back to Index of Texts
            </Link>
          </p>
        </div>
      </Layout>
    )
  }

  const seriesChapters = document.series_key ? getSeriesChapters(document.series_key) : []

  // An admin sees the text as it will read once its staged changes are
  // published, with a banner saying so and a way back to what everyone
  // else sees. Every bilingual pair's entry point is its English half, so
  // a staged German body replaces the counterpart.
  const viewing = staged && showStaged ? staged : null
  const title = viewing?.title ?? document.title
  const summary =
    viewing && 'summary' in viewing ? (viewing.summary ?? null) : document.summary
  const content =
    viewing?.content !== undefined
      ? resolveImagePlaceholders(viewing.content)
      : document.content
  const counterpart =
    viewing?.content_de !== undefined
      ? resolveImagePlaceholders(viewing.content_de)
      : document.parallel?.content

  return (
    <Layout>
      {document.header_image_url && (
        <TextHeader
          imageUrl={resolveImageUrl(document.header_image_url)}
          caption={document.header_image_caption}
        />
      )}
      <div className="p-6 max-w-4xl">
        {displayKicker(document.series_title) && (
          <p className="text-sm text-fe-brown mb-1">
            {displayKicker(document.series_title)}
          </p>
        )}
        {/* text-xl/2xl, not text-2xl/3xl -- see FamilyPage.tsx's own
            comment on this: gives a long document title more room. */}
        {isAdmin && (
          <AdminTextNotice
            documentId={document.document_id}
            staged={staged}
            showStaged={showStaged}
            onToggle={() => setShowStaged((v) => !v)}
          />
        )}
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          <InlineMarkdown>{title}</InlineMarkdown>
        </h1>
        {/* The genre stamp stays. Opa asked to "consider removing" it
            unless it served a purpose -- it does, so it's kept here and
            on the index rows. */}
        <p className="text-sm text-fe-ink/70 mb-4">
          <TextByline authors={getDocumentAuthors(document)} genre={document.genre} />
        </p>

        <TextBody
          summary={summary}
          content={content}
          parallel={
            document.parallel
              ? {
                  german:
                    document.parallel.language === 'de' ? (counterpart ?? '') : content,
                  english:
                    document.parallel.language === 'de' ? content : (counterpart ?? ''),
                }
              : null
          }
        />

        {/* There was a previous/next pair of arrows here, shown on
            every parallel text. It went at the archivist's request: the
            full chapter list sits directly beneath it, every entry
            already a link, so the arrows offered a second route to two
            of the places that list already goes. */}

        {seriesChapters.length > 0 && (
          <div className="mt-8">
            <h2 className="font-bold text-sm text-fe-brown mb-2">
              Chapters in this series
            </h2>
            <ol className="space-y-1 text-sm">
              {seriesChapters.map((chapter) =>
                chapter.document_id === document.document_id ? (
                  <li key={chapter.document_id} className="font-bold">
                    <InlineMarkdown>{chapter.title}</InlineMarkdown>
                  </li>
                ) : (
                  <li key={chapter.document_id}>
                    <Link
                      to={`/documents/${chapter.document_id}`}
                      className="text-fe-link hover:text-fe-link-dark"
                    >
                      <InlineMarkdown>{chapter.title}</InlineMarkdown>
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

// Admins only: a way into the editor, and -- when changes are waiting on
// this text -- a note saying the page is showing them, with a switch
// back to the published version.
function AdminTextNotice({
  documentId,
  staged,
  showStaged,
  onToggle,
}: {
  documentId: number
  staged: StagedText | null
  showStaged: boolean
  onToggle: () => void
}) {
  const editLink = (
    <Link
      to={`/admin/edit/text/${documentId}`}
      className="text-fe-link hover:text-fe-link-dark"
    >
      Edit this text
    </Link>
  )
  if (!staged) return <p className="text-sm mb-2">{editLink}</p>

  const drafts = staged.edits.some((e) => e.status === 'draft')
  return (
    <div
      className="mb-3 border-l-4 border-fe-accent bg-white/60 px-3 py-2 text-sm"
      role="status"
    >
      <p>
        {showStaged
          ? `Showing changes not yet published (${drafts ? 'some still a draft' : 'submitted'}). Visitors see the current version.`
          : 'Showing the current version, as visitors see it. Changes are waiting.'}
        {staged.is_published === false && (
          <strong> Once published, this text will be hidden from visitors.</strong>
        )}
      </p>
      <p className="mt-1 space-x-4">
        <button
          type="button"
          onClick={onToggle}
          className="text-fe-link hover:text-fe-link-dark"
        >
          {showStaged ? 'Show the current version' : 'Show the changes'}
        </button>
        {editLink}
      </p>
    </div>
  )
}
