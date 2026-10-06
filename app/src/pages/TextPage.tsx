import { type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { type ExtraProps } from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import DocumentEmbeddedImage from '../components/DocumentEmbeddedImage'
import DocumentWideImage from '../components/DocumentWideImage'
import InlineMarkdown from '../components/InlineMarkdown'
import TextByline from '../components/TextByline'
import Layout from '../components/Layout'
import ParallelText from '../components/ParallelText'
import { getDocumentById, getSeriesChapters } from '../data-access/public/documents'
import { useHeaderRef } from '../hooks/useHeaderRef'
import { displayKicker, getAuthorPerson } from '../utils/textDisplay'
import { resolveImageUrl } from '../utils/imageUrl'
import { markdownLink } from '../utils/markdownLink'

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
    ...markdownLink,
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
  const headerRef = useHeaderRef()
  return (
    <>
      <div
        ref={headerRef}
        className="max-w-4xl h-64 sm:h-80 bg-fe-brown/20 flex items-center justify-center overflow-hidden"
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </div>
      {/* text-balance for the same reason gallery captions have it: a
          two-line caption otherwise fills the first line and leaves a
          stub on the second. The Family page's own header caption
          already solved this with text-pretty and a width search (see
          FamilyCaption there); this one had nothing. */}
      {caption && (
        <p className="max-w-4xl mt-2 text-[11px] leading-tight text-fe-ink/60 text-balance">
          <InlineMarkdown>{caption}</InlineMarkdown>
        </p>
      )}
    </>
  )
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
            <Link to="/documents" className="text-fe-link hover:text-fe-link-dark">
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
  // Both halves feed one width sequence, so a photo in the German
  // column and one in the English column don't independently restart the
  // rotation and land on the same size beside each other.
  const imageComponents = createImageComponents(
    buildImageWidths(
      document.parallel
        ? `${document.content}\n\n${document.parallel.content}`
        : document.content,
    ),
  )

  // Where this chapter sits in its series, for the previous/next links
  // below. These used to be written by hand into the end of each
  // document ("**Next:** [On the High Seas](/documents/88)"); splitting
  // a parallel text strips them, since an English-only navigation line
  // has no German counterpart to pair with. Derived here instead, which
  // also means they cannot go stale.
  const chapterIndex = seriesChapters.findIndex(
    (chapter) => chapter.document_id === document.document_id,
  )
  const previousChapter = chapterIndex > 0 ? seriesChapters[chapterIndex - 1] : null
  const nextChapter =
    chapterIndex >= 0 && chapterIndex < seriesChapters.length - 1
      ? seriesChapters[chapterIndex + 1]
      : null

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
        <h1 className="text-xl sm:text-2xl font-bold mb-2">{document.title}</h1>
        {/* The genre stamp stays. Opa asked to "consider removing" it
            unless it served a purpose -- it does, so it's kept here and
            on the index rows. */}
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
            {/* pl-24 (1in at 96dpi) and text-[14px], both per Opa's
                review: "indent summary graf an inch on the left and make
                the summary graf a point or two larger than the body
                text". app/CLAUDE.md had listed that indent under
                "deliberately NOT replicated from the original site" --
                it has now been asked for by the person whose site it is,
                and that file has been corrected so it isn't removed
                again as a stray re-addition. */}
            <div className="max-w-none mb-6 pl-8 sm:pl-24 text-[14px] text-fe-ink flow-root [&>*:last-child]:mb-0">
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

        {document.parallel ? (
          <ParallelText
            german={
              document.parallel.language === 'de'
                ? document.parallel.content
                : document.content
            }
            english={
              document.parallel.language === 'de'
                ? document.content
                : document.parallel.content
            }
            components={imageComponents}
          />
        ) : document.content.trim() ? (
          <div className="max-w-none text-[12px] text-fe-ink flow-root">
            <ReactMarkdown components={imageComponents}>{document.content}</ReactMarkdown>
          </div>
        ) : (
          // Five published documents have a summary and no text at all
          // -- 98, 119, and three chapters of Nana's memoir. They used
          // to render the header, the title, the byline, the summary and
          // the rule that exists to separate summary from body, and then
          // stop. The rule read as a promise of text that wasn't there,
          // so the page looked broken rather than unfinished.
          //
          // Said here rather than fixed in the data, because it is true
          // of any document whose transcription hasn't been done yet and
          // the archive will have more of them.
          <p className="text-[12px] italic text-fe-ink/70">
            The text of this piece hasn&rsquo;t been transcribed into the archive yet.
          </p>
        )}

        {/* Only where the hand-written links were removed. Documents
            that still carry their own "Next:" line would otherwise show
            the same link twice. */}
        {document.parallel && (previousChapter || nextChapter) && (
          <nav className="mt-8 flex justify-between gap-4 text-sm">
            {previousChapter ? (
              <Link
                to={`/documents/${previousChapter.document_id}`}
                className="text-fe-link hover:text-fe-link-dark"
              >
                &larr; {previousChapter.title}
              </Link>
            ) : (
              <span />
            )}
            {nextChapter && (
              <Link
                to={`/documents/${nextChapter.document_id}`}
                className="text-fe-link hover:text-fe-link-dark text-right"
              >
                {nextChapter.title} &rarr;
              </Link>
            )}
          </nav>
        )}

        {seriesChapters.length > 0 && (
          <div className="mt-8">
            <h2 className="font-bold text-sm text-fe-brown mb-2">
              Chapters in this series
            </h2>
            <ol className="space-y-1 text-sm">
              {seriesChapters.map((chapter) =>
                chapter.document_id === document.document_id ? (
                  <li key={chapter.document_id} className="font-bold">
                    {chapter.series_order ? `${chapter.series_order}. ` : ''}
                    {chapter.title}
                  </li>
                ) : (
                  <li key={chapter.document_id}>
                    <Link
                      to={`/documents/${chapter.document_id}`}
                      className="text-fe-link hover:text-fe-link-dark"
                    >
                      {chapter.series_order ? `${chapter.series_order}. ` : ''}
                      {chapter.title}
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
