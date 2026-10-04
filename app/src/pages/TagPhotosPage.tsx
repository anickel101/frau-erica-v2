import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import IconAction from '../components/IconAction'
import InlineMarkdown from '../components/InlineMarkdown'
import Layout from '../components/Layout'
import SearchInput from '../components/SearchInput'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  GROUP_SLUGS,
  getTaggableGallery,
  groupSlugFor,
  listTaggableGalleries,
} from '../data-access/public/taggableGalleries'
import type { GalleryPhoto } from '../data-access/public/galleries'
import {
  addPhotoTag,
  listAllPhotoTags,
  listPhotoTags,
  removePhotoTag,
} from '../data-access/gated/photoTags'
import type { PhotoTag } from '../data-access/gated/photoTags'
import { mockPersons } from '../data/mockPersons'
import type { Person } from '../types/person'
import { getFullName } from '../utils/personDisplay'
import {
  personLabel,
  suggestPeople,
  unresolvedCaptionNames,
} from '../utils/tagSuggestions'

// Recording who appears in each photograph.
//
// Built for one person working through hundreds of photographs across
// weeks, which drives nearly every decision here:
//
//   - Tags save the instant they are tapped. There is no Save button to
//     forget and no form to lose. An evening's work cannot evaporate
//     because a tab was closed.
//   - Progress and position are visible, and the page opens on the first
//     untagged photograph rather than the first photograph.
//   - Nothing is ever required. Skip is as prominent as anything else,
//     because "I don't know who that is" is a legitimate and common
//     answer, and a tool that argues with it stops being used.
//   - Nothing here can damage the archive. Tags live in their own store
//     and reach the family data later, in a batch someone reads first.

export default function TagPhotosPage() {
  const { galleryId } = useParams<{ galleryId: string }>()
  if (!galleryId) return <ChooseGallery />
  // "headers" and "misc" name the two synthetic groups; anything else is
  // a real gallery id. See taggableGalleries.ts for why those two have
  // slugs rather than appearing as -1 and -2 in the URL.
  return <TagGallery galleryId={GROUP_SLUGS[galleryId] ?? Number(galleryId)} />
}

// ---------------------------------------------------------------- picker

function ChooseGallery() {
  const galleries = useMemo(() => listTaggableGalleries(), [])
  const [tags, setTags] = useState<PhotoTag[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listAllPhotoTags()
      .then((loaded) => {
        if (!cancelled) setTags(loaded)
      })
      // A failed load is not worth an error here: the list still works,
      // it just shows no progress. Saying "couldn't load progress" above
      // a perfectly usable page would be alarming out of proportion.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // What has been tagged, and what of that is not yet in the archive.
  //
  // The second number is the one with no other home. A tag lives in its
  // own store until someone applies it, and until now nothing anywhere
  // said how much was waiting -- the only way to find out was to run a
  // script on the archivist's machine. Computable here because the page
  // already holds both halves: the collected tags from the API, and the
  // applied ones in each photograph's personIds.
  const progress = useMemo(() => {
    const byGallery = new Map<number, { tagged: Set<number>; unapplied: number }>()
    if (!tags) return byGallery

    const applied = new Set<string>()
    for (const gallery of galleries) {
      for (const photo of gallery.photos) {
        for (const personId of photo.personIds) {
          applied.add(`${photo.image_id}:${personId}`)
        }
      }
    }

    for (const tag of tags) {
      const entry = byGallery.get(tag.gallery_id) ?? { tagged: new Set(), unapplied: 0 }
      entry.tagged.add(tag.image_id)
      if (!applied.has(`${tag.image_id}:${tag.person_id}`)) entry.unapplied += 1
      byGallery.set(tag.gallery_id, entry)
    }
    return byGallery
  }, [tags, galleries])

  const waiting = [...progress.values()].reduce((n, g) => n + g.unapplied, 0)

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-1">Tag photographs</h1>
        <p className="text-sm text-fe-ink/70 mb-4 max-w-prose">
          Pick a gallery, then say who is in each photograph. Your work saves as you go,
          so you can stop whenever you like and pick up where you left off. Tagging the
          same person twice does nothing &mdash; so if you aren&rsquo;t sure whether you
          already tagged someone, just tag them.
        </p>

        {/* The answer to "is there anything waiting?", which previously
            existed nowhere. Tags are collected separately from the
            archive and applied in a reviewed batch, so there is always a
            gap between tagging and anything appearing on the site --
            this says how wide it currently is, rather than leaving
            someone to wonder whether their work registered. */}
        {waiting > 0 && (
          <p className="mb-6 border-l-2 border-fe-accent bg-fe-brown/5 py-2 pl-3 text-sm text-fe-ink/80">
            <strong>{waiting}</strong> {waiting === 1 ? 'tag is' : 'tags are'} saved but
            not yet added to the archive, so {waiting === 1 ? 'it has' : 'they have'} not
            appeared on the gallery pages yet. Anson adds them in batches &mdash; nothing
            is lost in the meantime.
          </p>
        )}

        <ul className="space-y-0">
          {galleries.map((gallery) => {
            const done = progress.get(gallery.gallery_id)
            const taggedCount = done?.tagged.size ?? 0
            const total = gallery.photos.length
            return (
              <li key={gallery.gallery_id}>
                <Link
                  to={`/admin/tag-photos/${groupSlugFor(gallery.gallery_id)}`}
                  className="flex items-baseline justify-between gap-4 border-b border-fe-brown/20 py-3 hover:bg-black/5"
                >
                  <span className="text-base font-bold text-fe-ink">{gallery.name}</span>
                  <span className="shrink-0 text-right text-xs text-fe-ink/60">
                    {tags === null ? (
                      `${total} photographs`
                    ) : taggedCount === 0 ? (
                      `none of ${total} tagged`
                    ) : taggedCount >= total ? (
                      <span className="text-fe-ink/80">all {total} tagged</span>
                    ) : (
                      `${taggedCount} of ${total} tagged`
                    )}
                    {done && done.unapplied > 0 && (
                      <span className="block text-fe-accent-dark">
                        {done.unapplied} awaiting the archive
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </Layout>
  )
}

// --------------------------------------------------------------- tagging

function TagGallery({ galleryId }: { galleryId: number }) {
  const gallery = useMemo(() => getTaggableGallery(galleryId), [galleryId])
  const [tags, setTags] = useState<PhotoTag[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset for a new gallery at render time, not at the top of the effect
  // below -- a synchronous setState inside an effect is a cascading
  // render, which react-hooks flags. Same idiom PersonInfoDialog and
  // GalleriesPage already use.
  const [loadedGallery, setLoadedGallery] = useState(galleryId)
  if (loadedGallery !== galleryId) {
    setLoadedGallery(galleryId)
    setTags(null)
    setLoadError(false)
    setStarted(false)
    setIndex(0)
  }

  useEffect(() => {
    let cancelled = false
    listPhotoTags(galleryId)
      .then((loaded) => {
        if (!cancelled) setTags(loaded)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [galleryId])

  // Open on the first photograph with no tags yet, so resuming after a
  // week doesn't mean scrolling past work already done. Render-time
  // reset rather than an effect (the same idiom PersonInfoDialog uses),
  // and only once per gallery -- afterwards the archivist's own
  // navigation wins.
  if (tags && gallery && !started) {
    setStarted(true)
    const tagged = new Set(tags.map((t) => t.image_id))
    const firstUntagged = gallery.photos.findIndex((p) => !tagged.has(p.image_id))
    if (firstUntagged > 0) setIndex(firstUntagged)
  }

  const apply = useCallback(
    async (action: Promise<unknown>, optimistic: (current: PhotoTag[]) => PhotoTag[]) => {
      const before = tags ?? []
      setTags(optimistic(before))
      setSaveError(null)
      try {
        await action
      } catch {
        // Put it back. Showing a tag that didn't save would be worse
        // than the error: the archivist would move on believing a
        // photograph was done.
        setTags(before)
        setSaveError('That didn’t save. Check your connection and try again.')
      }
    },
    [tags],
  )

  if (!gallery) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl">
          <p className="text-sm text-fe-ink/60">
            No such gallery.{' '}
            <Link to="/admin/tag-photos" className="text-fe-link hover:text-fe-link-dark">
              Back to the list
            </Link>
          </p>
        </div>
      </Layout>
    )
  }

  const photo = gallery.photos[index]
  const taggedImageIds = new Set((tags ?? []).map((t) => t.image_id))
  const doneCount = gallery.photos.filter((p) => taggedImageIds.has(p.image_id)).length

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <p className="text-sm text-fe-brown mb-1">
          <Link to="/admin/tag-photos" className="hover:text-fe-link-dark">
            Tag photographs
          </Link>
        </p>
        <h1 className="text-xl sm:text-2xl font-bold mb-1">{gallery.name}</h1>
        <p className="text-sm text-fe-ink/70 mb-4">
          Photograph {index + 1} of {gallery.photos.length} &middot; {doneCount} tagged so
          far
        </p>

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            Couldn&rsquo;t load the tags already on this gallery. Reload the page before
            tagging, so you don&rsquo;t repeat work already done.
          </p>
        )}
        {saveError && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {saveError}
          </p>
        )}

        {tags === null && !loadError ? (
          <p className="text-sm text-fe-ink/60">Loading&hellip;</p>
        ) : photo ? (
          <PhotoTagger
            photo={photo}
            galleryId={galleryId}
            galleryPersonIds={gallery.linkedPersonIds}
            allTags={tags ?? []}
            onAdd={(person) =>
              apply(
                addPhotoTag(photo.image_id, person.person_id, galleryId),
                (current) => [
                  ...current,
                  {
                    image_id: photo.image_id,
                    person_id: person.person_id,
                    gallery_id: galleryId,
                    tagged_by: 'you',
                    tagged_at: new Date().toISOString(),
                  },
                ],
              )
            }
            onRemove={(personId) =>
              apply(removePhotoTag(photo.image_id, personId), (current) =>
                current.filter(
                  (t) => !(t.image_id === photo.image_id && t.person_id === personId),
                ),
              )
            }
          />
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-fe-brown/20 pt-4">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="text-sm text-fe-link hover:text-fe-link-dark disabled:text-fe-ink/30"
          >
            &larr; Previous
          </button>
          {/* As prominent as anything else on the page. "I don't know who
              that is" is a legitimate answer, and a tool that makes it
              feel like a failure is a tool that gets abandoned. */}
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(gallery.photos.length - 1, i + 1))}
            disabled={index >= gallery.photos.length - 1}
            className="text-sm font-bold text-fe-link hover:text-fe-link-dark disabled:text-fe-ink/30"
          >
            Skip / Next &rarr;
          </button>
        </div>
      </div>
    </Layout>
  )
}

function PhotoTagger({
  photo,
  galleryId,
  galleryPersonIds,
  allTags,
  onAdd,
  onRemove,
}: {
  photo: GalleryPhoto
  galleryId: number
  galleryPersonIds: number[]
  allTags: PhotoTag[]
  onAdd: (person: Person) => void
  onRemove: (personId: number) => void
}) {
  const [query, setQuery] = useState('')

  // Cleared whenever the photograph changes, so a search left over from
  // the previous one doesn't hide this one's suggestions. Render-time
  // reset, not an effect.
  const [renderedImage, setRenderedImage] = useState(photo.image_id)
  if (renderedImage !== photo.image_id) {
    setRenderedImage(photo.image_id)
    setQuery('')
  }

  const onThisPhoto = allTags.filter((t) => t.image_id === photo.image_id)
  const onThisPhotoIds = onThisPhoto.map((t) => t.person_id)
  const elsewhereInGallery = [
    ...new Set(
      allTags.filter((t) => t.image_id !== photo.image_id).map((t) => t.person_id),
    ),
  ]

  const suggestions = suggestPeople({
    caption: photo.caption,
    galleryPersonIds,
    taggedElsewhereInGallery: elsewhereInGallery,
    alreadyOnThisPhoto: onThisPhotoIds,
    persons: mockPersons,
  })

  const ambiguous = unresolvedCaptionNames(photo.caption, mockPersons, suggestions)

  const results = query.trim()
    ? mockPersons
        .filter((p) => getFullName(p).toLowerCase().includes(query.trim().toLowerCase()))
        .filter((p) => !onThisPhotoIds.includes(p.person_id))
        .slice(0, 8)
    : []

  const personById = new Map(mockPersons.map((p) => [p.person_id, p]))

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <img
          src={photo.url}
          alt=""
          className="w-full border border-fe-brown/30 bg-fe-brown/10 object-contain"
        />
        {/* The caption is the archivist's own words, and it very often
            names the people in the photograph outright. Shown large and
            next to the picture because reading it is faster than
            recalling a face. */}
        {photo.caption && (
          <div className="mt-2 text-[13px] leading-snug text-fe-ink/80">
            <InlineMarkdown>{photo.caption}</InlineMarkdown>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-bold text-fe-brown mb-2">In this photograph</h2>
        {onThisPhoto.length === 0 ? (
          <p className="mb-4 text-xs text-fe-ink/60">Nobody tagged yet.</p>
        ) : (
          <ul className="mb-4 space-y-1">
            {onThisPhoto.map((tag) => {
              const person = personById.get(tag.person_id)
              return (
                <li
                  key={tag.person_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>{person ? getFullName(person) : `Person ${tag.person_id}`}</span>
                  <IconAction
                    variant="danger"
                    label="Remove"
                    onClick={() => onRemove(tag.person_id)}
                  >
                    <XMarkIcon />
                  </IconAction>
                </li>
              )
            })}
          </ul>
        )}

        {suggestions.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-fe-brown mb-2">Likely</h2>
            <ul className="mb-4 space-y-1">
              {suggestions.map(({ person, reason }) => (
                <li key={person.person_id}>
                  <button
                    type="button"
                    onClick={() => onAdd(person)}
                    className="w-full cursor-pointer rounded-sm border border-fe-brown/30 px-2 py-1.5 text-left text-sm hover:bg-fe-brown hover:text-white"
                  >
                    {personLabel(person)}
                    <span className="block text-[11px] opacity-70">{reason}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* An ambiguous caption name is a question only the archivist can
            answer -- which Mark? Offered as one tap into the search
            rather than silently dropped. */}
        {ambiguous.length > 0 && (
          <p className="mb-4 text-xs text-fe-ink/70">
            The caption also mentions{' '}
            {ambiguous.map((name, i) => (
              <span key={name}>
                {i > 0 && ', '}
                <button
                  type="button"
                  onClick={() => setQuery(name)}
                  className="cursor-pointer text-fe-link underline hover:text-fe-link-dark"
                >
                  {name}
                </button>
              </span>
            ))}
            .
          </p>
        )}

        <h2 className="text-sm font-bold text-fe-brown mb-2">Someone else</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name..." />
        <ul className="mt-2 space-y-1">
          {results.map((person) => (
            <li key={person.person_id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(person)
                  setQuery('')
                }}
                className="w-full cursor-pointer rounded-sm px-2 py-1 text-left text-sm hover:bg-fe-brown hover:text-white"
              >
                {personLabel(person)}
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 && (
            <li className="px-2 py-1 text-xs text-fe-ink/60">Nobody by that name.</li>
          )}
        </ul>
        <p className="mt-4 text-[11px] text-fe-ink/50">
          Gallery {galleryId}. Tags save as you tap them.
        </p>
      </div>
    </div>
  )
}
