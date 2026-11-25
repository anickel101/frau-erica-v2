import { type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { type ExtraProps } from 'react-markdown'
import DocumentEmbeddedImage from './DocumentEmbeddedImage'
import DocumentImageStrip from './DocumentImageStrip'
import DocumentWideImage from './DocumentWideImage'
import ParallelText from './ParallelText'
import { getImageDimensions } from '../data-access/public/documentImages'
import {
  floatWidth,
  imagesIn,
  isExhibit,
  segmentContent,
  type ContentSegment,
} from '../utils/documentImageLayout'
import { markdownLink } from '../utils/markdownLink'

// A text's summary and body, exactly as readers see them: the floated and
// strip photographs, the paragraph, list and rule styling, the parallel
// layout for a bilingual work. Shared by the text page and the admin
// editor's preview, so the preview is the page -- the two cannot drift.
//
// Takes markdown with its {{image:ID}} placeholders already resolved (see
// data-access/public/documentImages.ts).

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

export interface TextBodyProps {
  summary: string | null
  content: string
  // A bilingual work's two halves, set side by side; content is then the
  // entry point's own half, as on the page.
  parallel: { german: string; english: string } | null
}

export default function TextBody({ summary, content, parallel }: TextBodyProps) {
  // content only -- {{image:ID}} shortcodes in a summary are
  // never resolved to real markdown image syntax in the first place (see
  // data-access/public/documents.ts), and confirmed against the real
  // data that no document's summary actually has one anyway.
  // Both halves feed one width sequence, so a photo in the German
  // column and one in the English column don't independently restart the
  // rotation and land on the same size beside each other.
  // Exhibit and strips apply to single-language texts. The parallel
  // layout pairs paragraph against paragraph, so its images stay one per
  // block, where they float within their own column.
  const exhibit = !parallel && isExhibit(content)
  const segments: ContentSegment[] =
    parallel || exhibit ? [{ kind: 'markdown', text: content }] : segmentContent(content)
  // The entry point's half first, then its counterpart -- the order the
  // width rotation has always stepped through them in.
  const counterpart =
    parallel && (parallel.german === content ? parallel.english : parallel.german)
  const floatedMarkdown = parallel
    ? `${content}\n\n${counterpart}`
    : segments.flatMap((s) => (s.kind === 'markdown' ? [s.text] : [])).join('\n\n')
  const imageComponents = createImageComponents(
    buildImageWidths(floatedMarkdown),
    exhibit,
  )

  return (
    <>
      {summary && (
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
            <ReactMarkdown components={imageComponents}>{summary}</ReactMarkdown>
          </div>
          {/* Same rule style as the sidebar's own section dividers
                (border-t-[1.5px] border-fe-brown), separating the
                summary from the main text below it. */}
          <hr className="border-t-[1.5px] border-fe-brown mb-6" />
        </>
      )}

      {parallel ? (
        <ParallelText
          german={parallel.german}
          english={parallel.english}
          components={imageComponents}
        />
      ) : content.trim() ? (
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
    </>
  )
}
