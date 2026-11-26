import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import InlineMarkdown from '../components/InlineMarkdown'
import Layout from '../components/Layout'
import {
  listHiddenImages,
  type EditableRecord,
  type QueuedRecordEdit,
} from '../data-access/gated/recordEdits'
import {
  listHiddenTexts,
  type EditableText,
  type TextEdit,
} from '../data-access/gated/textEdits'
import { resolveImageUrl } from '../utils/imageUrl'

// Everything hidden from visitors -- unpublished texts and photographs --
// and the way back for each: open it in its editor and check "Published
// on the site". The site's own data holds published things only, so this
// list comes from the archive through the API.
//
// A hidden item marked "coming back" already has that change waiting to
// be applied.

export default function HiddenPage() {
  const [texts, setTexts] = useState<{ texts: EditableText[]; edits: TextEdit[] } | null>(
    null,
  )
  const [images, setImages] = useState<{
    images: EditableRecord[]
    edits: QueuedRecordEdit[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    Promise.all([listHiddenTexts(), listHiddenImages()])
      .then(([t, i]) => {
        if (!current) return
        setTexts(t)
        setImages(i)
      })
      .catch((e: Error) => current && setError(e.message))
    return () => {
      current = false
    }
  }, [])

  return (
    <Layout>
      <div className="p-6 max-w-5xl">
        <h1 className="text-xl font-bold mb-1">Hidden texts and photos</h1>
        <p className="text-sm text-fe-ink/70 mb-6">
          Hidden from visitors, kept in the archive. To bring one back, open it and check
          &ldquo;Published on the site&rdquo;, then submit.
        </p>
        {error ? (
          <p className="text-sm text-red-700">
            Couldn&rsquo;t load the hidden list: {error}
          </p>
        ) : !texts || !images ? (
          <p className="text-sm text-fe-ink/60">Loading...</p>
        ) : (
          <>
            <HiddenTexts texts={texts.texts} edits={texts.edits} />
            <HiddenImages images={images.images} edits={images.edits} />
          </>
        )}
      </div>
    </Layout>
  )
}

function ComingBack() {
  return (
    <span className="ml-2 rounded-sm bg-fe-gen-child/40 px-1.5 py-0.5 text-[11px] font-bold text-fe-ink">
      coming back
    </span>
  )
}

function HiddenTexts({ texts, edits }: { texts: EditableText[]; edits: TextEdit[] }) {
  const returning = new Set(
    edits
      .filter((e) => e.field === 'is_published' && e.value === true)
      .map((e) => e.document_id),
  )
  return (
    <section className="mb-8">
      <h2 className="font-bold text-fe-brown mb-2">Texts ({texts.length})</h2>
      {texts.length === 0 ? (
        <p className="text-sm text-fe-ink/60">No hidden texts.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {texts.map((text) => (
            <li key={text.document_id}>
              <Link
                to={`/admin/edit/text/${text.document_id}`}
                className="text-fe-link hover:text-fe-link-dark"
              >
                <InlineMarkdown>
                  {text.title || `Text ${text.document_id}`}
                </InlineMarkdown>
              </Link>
              {text.series_title && (
                <span className="text-fe-ink/60"> · {text.series_title}</span>
              )}
              {returning.has(text.document_id) && <ComingBack />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function HiddenImages({
  images,
  edits,
}: {
  images: EditableRecord[]
  edits: QueuedRecordEdit[]
}) {
  const returning = useMemo(
    () =>
      new Set(
        edits
          .filter((e) => e.field === 'is_published' && e.value === true)
          .map((e) => e.entity),
      ),
    [edits],
  )
  return (
    <section>
      <h2 className="font-bold text-fe-brown mb-2">Photographs ({images.length})</h2>
      {images.length === 0 ? (
        <p className="text-sm text-fe-ink/60">No hidden photographs.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {images.map((image) => (
            <HiddenImage
              key={String(image.image_id)}
              image={image}
              returning={returning.has(`image#${image.image_id}`)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function HiddenImage({
  image,
  returning,
}: {
  image: EditableRecord
  returning: boolean
}) {
  // A hidden photograph's file was sometimes never put on the image
  // server; such a one can't come back, and says so here.
  const [missing, setMissing] = useState(false)
  return (
    <li>
      <Link to={`/admin/edit/image/${image.image_id}`} className="group block">
        <span className="flex aspect-square items-center justify-center overflow-hidden border-2 border-transparent bg-fe-brown/20 group-hover:border-fe-accent">
          {missing ? (
            <span className="px-1 text-center text-[11px] text-fe-ink/60">No file</span>
          ) : (
            <img
              src={resolveImageUrl(String(image.url))}
              alt=""
              loading="lazy"
              onError={() => setMissing(true)}
              className="h-full w-full object-cover object-top"
            />
          )}
        </span>
        <span className="mt-1 block text-[11px] leading-tight text-fe-ink/70 line-clamp-2">
          #{String(image.image_id)} · {String(image.title || image.url)}
        </span>
      </Link>
      {returning && <ComingBack />}
    </li>
  )
}
