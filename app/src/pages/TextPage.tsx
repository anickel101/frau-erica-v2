import { type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { type ExtraProps } from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import DocumentEmbeddedImage from '../components/DocumentEmbeddedImage'
import DocumentImageStrip from '../components/DocumentImageStrip'
import DocumentWideImage from '../components/DocumentWideImage'
import InlineMarkdown from '../components/InlineMarkdown'
import TextByline from '../components/TextByline'
import Layout from '../components/Layout'
import ParallelText from '../components/ParallelText'
import { getSeriesChapters } from '../data-access/public/documents'
import { getDocumentById, getImageDimensions } from '../data-access/public/documentDetail'
import {
  floatWidth,
  imagesIn,
  isExhibit,
  segmentContent,
  type ContentSegment,
} from '../utils/documentImageLayout'
import { useHeaderRef } from '../hooks/useHeaderRef'
import { displayKicker, getDocumentAuthors } from '../utils/textDisplay'
import { resolveImageUrl } from '../utils/imageUrl'
import { markdownLink } from '../utils/markdownLink'

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
// Only floated images take a slot -- a modified image ("wide", an
// explicit pixel width) and a strip member are sized by other rules, so
// they shouldn't shift the variation the floated ones step through.
function buildImageWidths(floatedMarkdown: string): Map<string, number> {
  const widths = new Map<string, number>()
  let index = 0
  for (const { src, modifier } of imagesIn(floatedMarkdown)) {
    if (modifier) continue
    if (!widths.has(src)) {
      widths.set(src, floatWidth(getImageDimensions(src), index))
      index += 1
    }
  }
  return widths
}

// Renders every embedded <img> (from {{image:ID}} shortcodes, resolved
// to markdown image syntax -- see data-access/public/documentDetail.ts)
// via DocumentEmbeddedImage instead of a bare <img>, with the
// zoom-on-click modal. Images in a strip never reach here; TextPage hands
// those to DocumentImageStrip directly.
function createImageComponents(imageWidths: Map<string, number>, exhibit: boolean) {
  return {
    ...markdownLink,
    // title carries the {{image:ID:modifier}} modifier through markdown's
    // own image-title slot (see documentDetail.ts's
    // resolveImagePlaceholders) -- "wide" renders a full-width hero image;
    // a bare number pins an explicit floated width.
    img: ({ src, alt, title }: ComponentPropsWithoutRef<'img'> & ExtraProps) => {
      if (!src) return null
      if (title === 'wide') return <DocumentWideImage src={src} alt={alt} />
      // "stack" (a lone one -- a run of them becomes a strip): out of the
      // float, at the file's own size. Exhibit documents show every image
      // this way. Distinct from "wide", which fills the column and would
      // enlarge a small scan to do it.
      if (exhibit || title === 'stack') {
        return (
          <DocumentEmbeddedImage
            src={src}
            alt={alt}
            layout={{ kind: 'large', maxWidth: getImageDimensions(src)?.width }}
          />
        )
      }
      const explicitWidth = title && /^\d+$/.test(title) ? Number(title) : undefined
      return (
        <DocumentEmbeddedImage
          src={src}
          alt={alt}
          layout={{
            kind: 'float',
            width: explicitWidth ?? imageWidths.get(src) ?? floatWidth(undefined, 0),
          }}
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
    // Preflight strips list-style, padding and margin from <ul>/<ol>,
    // exactly as it zeroes <p>'s margin above -- so a markdown list
    // rendered as unmarked, unindented lines running straight into the
    // paragraph after it. Nothing in the archive had a list until the
    // Gerhard estate record, which is why this had never shown.
    //
    // The nested level gets a hollow marker and no bottom margin of its
    // own, so sub-items read as subordinate to their category and sit
    // tight under it. Only the outer list pushes the following
    // paragraph away.
    ul: ({ children }: ComponentPropsWithoutRef<'ul'>) => (
      <ul className="mb-4 ml-6 list-disc space-y-1 marker:text-fe-brown [&_ul]:mt-1 [&_ul]:mb-0 [&_ul]:list-[circle]">
        {children}
      </ul>
    ),
    ol: ({ children }: ComponentPropsWithoutRef<'ol'>) => (
      <ol className="mb-4 ml-6 list-decimal space-y-1 marker:text-fe-brown [&_ol]:mt-1 [&_ol]:mb-0">
        {children}
      </ol>
    ),
    // A markdown `---`. Preflight zeroes <hr>'s margin too, so the only
    // space around the rule was the mb-4 of the paragraph above it, and
    // the next line sat hard against it (the Sängerbote introduction, doc
    // 255, per the Archivist). Same mb-4 below, so the rule sits evenly
    // between the two. Also the footnote separator in 81, 98 and 169.
    hr: () => <hr className="mb-4" />,
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
  // document.content only -- {{image:ID}} shortcodes in a summary are
  // never resolved to real markdown image syntax in the first place (see
  // data-access/public/documents.ts), and confirmed against the real
  // data that no document's summary actually has one anyway.
  // Both halves feed one width sequence, so a photo in the German
  // column and one in the English column don't independently restart the
  // rotation and land on the same size beside each other.
  // Exhibit and strips apply to single-language texts. The parallel
  // layout pairs paragraph against paragraph, so its images stay one per
  // block, where they float within their own column.
  const exhibit = !document.parallel && isExhibit(document.content)
  const segments: ContentSegment[] =
    document.parallel || exhibit
      ? [{ kind: 'markdown', text: document.content }]
      : segmentContent(document.content)
  const floatedMarkdown = document.parallel
    ? `${document.content}\n\n${document.parallel.content}`
    : segments.flatMap((s) => (s.kind === 'markdown' ? [s.text] : [])).join('\n\n')
  const imageComponents = createImageComponents(
    buildImageWidths(floatedMarkdown),
    exhibit,
  )

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
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          <InlineMarkdown>{document.title}</InlineMarkdown>
        </h1>
        {/* The genre stamp stays. Opa asked to "consider removing" it
            unless it served a purpose -- it does, so it's kept here and
            on the index rows. */}
        <p className="text-sm text-fe-ink/70 mb-4">
          <TextByline authors={getDocumentAuthors(document)} genre={document.genre} />
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
            {segments.map((segment, i) =>
              segment.kind === 'strip' ? (
                <DocumentImageStrip
                  key={i}
                  images={segment.images}
                  dimensions={getImageDimensions}
                />
              ) : (
                <ReactMarkdown key={i} components={imageComponents}>
                  {segment.text}
                </ReactMarkdown>
              ),
            )}
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
