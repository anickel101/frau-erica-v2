import { type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { type ExtraProps } from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import DocumentEmbeddedImage from '../components/DocumentEmbeddedImage'
import DocumentWideImage from '../components/DocumentWideImage'
import Layout from '../components/Layout'
import TextByline from '../components/TextByline'
import { getDocumentById, getSeriesChapters } from '../data-access/public/documents'
import { getAuthorPerson } from '../utils/textDisplay'

// Modest variation around the old fixed 300px -- per review feedback,
// images at a single uniform width read as a stacked column running
// down the page.
const IMAGE_WIDTHS = [240, 300, 360]

// A bounce (240, 300, 360, 300, 240, 300, ...), not a hard reset-to-start
// cycle (240, 300, 360, 240, 300, ...) -- a plain modulo cycle can drop
// straight from the largest size back to the smallest between two
// adjacent images purely by coincidence of where a document's image
// count happens to land in the cycle (confirmed against a real document:
// its 4th and last image landed back on the smallest size, the opposite
// of "the last image should be larger" from review feedback for that
// exact page). Bouncing back down one step at a time instead of resetting
// guarantees that jump never happens, for any document length -- not
// just a fix for one specific image count.
function widthForImageIndex(index: number): number {
  const period = 2 * (IMAGE_WIDTHS.length - 1)
  const pos = index % period
  const bounceIndex = pos < IMAGE_WIDTHS.length ? pos : period - pos
  return IMAGE_WIDTHS[bounceIndex]
}

// Resolved markdown image syntax -- by the time content reaches here,
// {{image:ID}} shortcodes are already resolved to ![caption](url) or, for
// a {{image:ID:modifier}} shortcode, ![caption](url "modifier") (see
// data-access/public/documents.ts), which is the form actually rendered.
// Group 2 (the modifier) is undefined for a plain, unmodified image.
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g

// A pure, one-time scan over the resolved content, not a counter
// incremented as a side effect of rendering each <img> -- an earlier
// version mutated a shared counter from inside the img render function,
// which is exactly the kind of impure render React.StrictMode
// deliberately double-invokes to catch: every image ended up rendering
// the same width live, because the "real" committed call was always the
// second of a pair, landing on the same repeated index every time.
// Assigning widths up front here means the img renderer below only ever
// does a plain, side-effect-free lookup, safe to call any number of
// times. Keyed by URL (not just counted) so the same photo reused twice
// keeps a consistent size rather than picking up wherever the sequence
// happens to be on its second appearance.
function buildImageWidths(content: string): Map<string, number> {
  const widths = new Map<string, number>()
  let index = 0
  for (const match of content.matchAll(MARKDOWN_IMAGE)) {
    const [, src, modifier] = match
    // A modifier ("wide", or an explicit pixel width) means this image
    // opts out of the rotation entirely -- TextPage's img renderer below
    // handles it directly from the modifier, so it shouldn't consume a
    // slot in the sequence the remaining, unmodified images rotate through.
    if (modifier) continue
    if (!widths.has(src)) {
      widths.set(src, widthForImageIndex(index))
      index += 1
    }
  }
  return widths
}

// Renders every embedded <img> (from {{image:ID}} shortcodes, resolved
// to markdown image syntax -- see data-access/public/documents.ts) via
// DocumentEmbeddedImage instead of a bare <img> -- floats it so text
// wraps around it, and gets the zoom-on-click modal.
function createImageComponents(imageWidths: Map<string, number>) {
  return {
    // title carries the {{image:ID:modifier}} modifier through markdown's
    // own image-title slot (see MARKDOWN_IMAGE's comment above and
    // data-access/public/documents.ts's resolveImagePlaceholders) --
    // "wide" renders a full-width, non-floated hero image; a bare number
    // pins an explicit pixel width, overriding the rotation both here use
    // in place of. Neither case looks the src up in imageWidths, since
    // buildImageWidths deliberately skipped modified images when building
    // that map.
    img: ({ src, alt, title }: ComponentPropsWithoutRef<'img'> & ExtraProps) => {
      if (!src) return null
      if (title === 'wide') return <DocumentWideImage src={src} alt={alt} />
      const explicitWidth = title && /^\d+$/.test(title) ? Number(title) : undefined
      return (
        <DocumentEmbeddedImage
          src={src}
          alt={alt}
          width={explicitWidth ?? imageWidths.get(src)}
        />
      )
    },
    // Markdown always wraps a bare `![]()` in a <p> -- but DocumentEmbeddedImage
    // renders a block-level <figure> (with a <figcaption>), which is invalid
    // HTML nested inside a <p> (confirmed live: a real hydration warning, not
    // just a lint nitpick). Two distinct cases both need handling, not just
    // one: a paragraph whose *only* content is a single image (renders
    // unwrapped -- no <p>, no extra <div>, so a solo image doesn't pick up
    // an unwanted margin from a near-empty wrapper), and a paragraph with an
    // image *mixed into* other content -- e.g. "![](...)Click on..." with no
    // blank line between the image and the text, a real pattern in the
    // actual source content, not just a hypothetical. That second case still
    // contains a <figure>, so it still can't be a <p> -- it needs a <div>
    // instead, which can validly hold both the floated figure and the
    // flowing text around it. Every other (image-free) paragraph gets mb-4
    // -- Tailwind's preflight zeroes out <p>'s default browser margin, so
    // without this every paragraph ran directly into the next with no
    // visual break at all.
    p: ({ children, node }: ComponentPropsWithoutRef<'p'> & ExtraProps) => {
      const hasImageChild =
        node?.children.some(
          (child) => child.type === 'element' && child.tagName === 'img',
        ) ?? false
      if (node?.children.length === 1 && hasImageChild) return <>{children}</>
      if (hasImageChild) return <div className="mb-4">{children}</div>
      return <p className="mb-4">{children}</p>
    },
  }
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
  // document.content only -- {{image:ID}} shortcodes in a summary are
  // never resolved to real markdown image syntax in the first place (see
  // data-access/public/documents.ts), and confirmed against the real
  // data that no document's summary actually has one anyway.
  const imageComponents = createImageComponents(buildImageWidths(document.content))

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        {document.series_title && (
          <p className="text-sm text-fe-brown mb-1">{document.series_title}</p>
        )}
        {/* text-xl/2xl, not text-2xl/3xl -- see FamilyPage.tsx's own
            comment on this: gives a long document title more room. */}
        <h1 className="text-xl sm:text-2xl font-bold mb-2">{document.title}</h1>
        <p className="text-sm text-fe-ink/70 mb-4">
          <TextByline
            author={document.author}
            authorPerson={authorPerson}
            genre={document.genre}
          />
        </p>

        {document.summary && (
          <>
            {/* flow-root -- not overflow-hidden -- contains the floated
                DocumentEmbeddedImage figures without clipping anything,
                so this div's own height still includes a trailing image
                taller than the text next to it. flow-root also creates a
                new block-formatting context, though, which stops the
                last paragraph's own mb-4 (see createImageComponents' p
                override) from collapsing into this div's mb-6 the way it
                normally would -- without [&>*:last-child]:mb-0 both
                margins applied on top of each other (40px, not the
                intended 24px). This div's mb-6 is the single source of
                truth for the gap below the summary; the last child's own
                trailing margin is zeroed instead of relied on, so the
                gap stays correct no matter what markdown block the
                summary happens to end on. */}
            <div className="max-w-none mb-6 text-[12px] text-fe-ink flow-root [&>*:last-child]:mb-0">
              <ReactMarkdown components={imageComponents}>
                {document.summary}
              </ReactMarkdown>
            </div>
            {/* Same rule style as the sidebar's own section dividers
                (border-t-[1.5px] border-fe-brown), separating the
                summary from the main text below it. */}
            <hr className="border-t-[1.5px] border-fe-brown mb-6" />
          </>
        )}

        <div className="max-w-none text-[12px] text-fe-ink flow-root">
          <ReactMarkdown components={imageComponents}>{document.content}</ReactMarkdown>
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
