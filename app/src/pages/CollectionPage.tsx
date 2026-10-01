import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import TextByline from '../components/TextByline'
import InlineMarkdown from '../components/InlineMarkdown'
import { getCollectionBySlug } from '../data-access/public/collections'
import type { Collection } from '../data-access/public/collections'
import { getSeriesChapters } from '../data-access/public/documents'
import type { DocumentListItem } from '../data-access/public/documents'
import { useHeaderRef } from '../hooks/useHeaderRef'
import { getAuthorPerson, getSeriesRepresentative } from '../utils/textDisplay'

// One collection: its cover, what it is, and everything in it.
//
// The three kinds are presented differently because they ARE different,
// which is the whole reason the Series table records a kind. A memoir in
// twenty chapters wants to be read from the start; twenty-eight
// Christmas letters want the most recent first; a gathering of texts
// about one person has no order at all and shouldn't pretend to.
export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const collection = slug ? getCollectionBySlug(slug) : undefined

  if (!collection) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl">
          <p className="text-fe-ink/60 text-sm">
            Collection not found.{' '}
            <Link to="/collections" className="text-fe-link hover:text-fe-link-dark">
              Back to Collections
            </Link>
          </p>
        </div>
      </Layout>
    )
  }

  const chapters = getSeriesChapters(collection.series_key)
  const ordered = orderFor(collection, chapters)
  const representative = chapters.length > 0 ? getSeriesRepresentative(chapters) : null

  return (
    <Layout>
      {collection.cover_image_url && (
        <CollectionHeader imageUrl={collection.cover_image_url} />
      )}
      <div className="p-6 max-w-4xl">
        <p className="text-sm text-fe-brown mb-1">
          <Link to="/collections" className="hover:text-fe-link-dark">
            Collections
          </Link>
        </p>
        <h1 className="text-xl sm:text-2xl font-bold mb-2">{collection.name}</h1>
        <p className="text-sm text-fe-ink/70 mb-4">
          {countLabel(collection)}
          {representative?.genre ? ` · ${representative.genre}` : ''}
        </p>

        {collection.blurb && (
          <>
            {/* Indented and a shade larger, the same treatment a
                document's own summary gets on TextPage -- this is the
                same kind of thing in the same place, and should read
                the same way. */}
            <div className="max-w-none mb-6 pl-8 sm:pl-24 text-[14px] text-fe-ink">
              <p>{collection.blurb}</p>
            </div>
            <hr className="border-t-[1.5px] border-fe-brown mb-6" />
          </>
        )}

        <ol className="space-y-0">
          {ordered.map((chapter) => (
            <li key={chapter.document_id}>
              <ChapterRow chapter={chapter} showNumber={collection.kind === 'work'} />
            </li>
          ))}
        </ol>

        {chapters.length === 0 && (
          <p className="text-sm text-fe-ink/60">Nothing published here yet.</p>
        )}
      </div>
    </Layout>
  )
}

// Same shape and measurements as TextPage's own header, so a collection
// page and the text pages it leads to sit identically on the screen --
// and so the sidebar's divider, which aligns itself to the bottom edge
// of whatever header is on the page, lands in the same place on both.
function CollectionHeader({ imageUrl }: { imageUrl: string }) {
  const headerRef = useHeaderRef()
  return (
    <div
      ref={headerRef}
      className="max-w-4xl h-64 sm:h-80 bg-fe-brown/20 flex items-center justify-center overflow-hidden"
    >
      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
    </div>
  )
}

// getSeriesChapters already sorts by series_order, which is the reading
// order of a work. An annual run reverses it, so the most recent letter
// is first -- twenty-eight of them starting at 1995 would bury the ones
// people are most likely to want. A person collection keeps whatever
// order the archive recorded, since there is no better one to impose.
function orderFor(
  collection: Collection,
  chapters: DocumentListItem[],
): DocumentListItem[] {
  return collection.kind === 'annual' ? [...chapters].reverse() : chapters
}

function countLabel(collection: Collection): string {
  const n = collection.chapterCount
  if (collection.kind === 'annual') return `${n} letters`
  if (collection.kind === 'work') return `${n} chapters`
  return `${n} texts`
}

function ChapterRow({
  chapter,
  showNumber,
}: {
  chapter: DocumentListItem
  showNumber: boolean
}) {
  const authorPerson = getAuthorPerson(chapter)

  return (
    <article className="py-3 border-b border-fe-brown/20">
      <Link
        to={`/documents/${chapter.document_id}`}
        className="text-base font-bold text-fe-ink hover:text-fe-link-dark"
      >
        {/* series_order 0 marks the piece that introduces the rest
            rather than a chapter of it, and a null order means none was
            recorded -- neither should print a number. Falsy check, not
            === 0, so both cases are covered (see TextSeriesRow, where
            this rule was established). */}
        {showNumber && chapter.series_order ? `${chapter.series_order}. ` : ''}
        {chapter.title}
      </Link>
      <p className="text-xs text-fe-ink/70 mt-0.5">
        <TextByline
          author={chapter.author}
          authorPerson={authorPerson}
          genre={chapter.genre}
        />
      </p>
      {chapter.summary && (
        <p className="text-xs text-fe-ink/80 mt-1 line-clamp-2">
          <InlineMarkdown>{chapter.summary}</InlineMarkdown>
        </p>
      )}
    </article>
  )
}
