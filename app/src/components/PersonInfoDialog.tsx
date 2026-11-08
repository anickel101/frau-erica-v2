import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import InlineMarkdown from './InlineMarkdown'
import Modal from './Modal'
import { getPersonById } from '../data-access/gated/persons'
import type {
  LinkedPhoto,
  LinkedText,
  PersonLinks,
} from '../data-access/public/personLinks'
import { LinkedPersonSummary, PersonDetail } from '../types/person'
import { formatDate } from '../utils/dateDisplay'
import { getFullName } from '../utils/personDisplay'
import { buttonClassName } from '../utils/formStyles'

type LoadState =
  { kind: 'loading' } | { kind: 'ready'; detail: PersonDetail } | { kind: 'error' }

// How many thumbnails the pop-up shows before "See all", per the
// Archivist's "a row of up to, say, six or eight". Eight is two rows of
// four on a phone and one tidy grid on a desktop.
const PHOTO_LIMIT = 8
// How many texts a list shows before "Show all". Mark has 39 writings;
// a pop-up that long is a page, not a pop-up.
const LIST_LIMIT = 5

const sectionHeading = 'mb-2 text-xs font-bold uppercase tracking-wide text-fe-brown'
const linkClass = 'text-fe-link hover:text-fe-link-dark'

// The "More info" pop-up for one of a Family page's couple.
//
// Two halves. The person's own record -- born, died, their other family
// pages -- is fetched on open from GET /persons/:id. Everything else is
// what the archive connects to them (see data-access/public/personLinks.ts
// and the export's "Person links" section for the rules): photographs,
// their writings, other texts linked to them, galleries, collections.
//
// A photograph opens large INSIDE the pop-up, with a way back to it,
// rather than in a second dialog on top: the Archivist asked for "full
// screen with caption and clickable return to the popup". Escape steps
// back the same way before it closes anything.
//
// Two ways out, per the spec: an X at the top right, and a labelled
// Close button at the bottom, which is the one a screen reader lands on
// last and a keyboard user tabs to naturally. Escape and the backdrop
// also close it -- Modal handles both.
export default function PersonInfoDialog({
  person,
  links,
  currentFamilyId,
  open,
  onClose,
}: {
  person: LinkedPersonSummary
  links: PersonLinks | null
  // The family page the dialog was opened from, so "their family page"
  // isn't offered as a link to where the reader already is.
  currentFamilyId: number | null
  open: boolean
  onClose: () => void
}) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [zoomed, setZoomed] = useState<LinkedPhoto | null>(null)

  // Back to "loading", and out of any zoom, each time the dialog opens,
  // so a second open doesn't flash the previous person. A render-time
  // reset rather than a setState at the top of the effect, which React
  // flags as a cascading render.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setState({ kind: 'loading' })
      setZoomed(null)
    }
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getPersonById(person.person_id)
      .then((detail) => {
        if (!cancelled) setState({ kind: 'ready', detail })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [open, person.person_id])

  const name = getFullName(person)
  const firstName = person.preferred_first_name || person.first_name

  return (
    <Modal
      open={open}
      onClose={zoomed ? () => setZoomed(null) : onClose}
      label={`About ${name}`}
    >
      {/* stopPropagation, same as AdminUsersPage's dialogs: Modal closes
          on any click by default (its image-zoom callers want that), and
          a pop-up full of links must not vanish when someone clicks the
          whitespace beside one. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-sm bg-fe-bg p-6 pt-5 shadow-lg"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-fe-ink/60 transition hover:bg-black/10 hover:text-fe-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fe-accent"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <h2 className="pr-8 text-lg font-bold leading-snug">{name}</h2>

        {zoomed ? (
          <ZoomedPhoto
            photo={zoomed}
            backLabel={`Back to ${firstName}`}
            onBack={() => setZoomed(null)}
          />
        ) : (
          <>
            {state.kind === 'loading' && (
              <p className="mt-3 text-sm text-fe-ink/60">Loading...</p>
            )}
            {state.kind === 'error' && (
              <p className="mt-3 text-sm text-fe-ink/60">
                Something went wrong loading this person.
              </p>
            )}
            {state.kind === 'ready' && (
              <Details detail={state.detail} currentFamilyId={currentFamilyId} />
            )}

            {links && (
              <Connected
                personId={person.person_id}
                firstName={firstName}
                links={links}
                onZoom={setZoomed}
              />
            )}
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={buttonClassName}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Connected({
  personId,
  firstName,
  links,
  onZoom,
}: {
  personId: number
  firstName: string
  links: PersonLinks
  onZoom: (photo: LinkedPhoto) => void
}) {
  const { photos, writings, texts, galleries, collections } = links
  return (
    <>
      {photos.length > 0 && (
        <Section title="Photographs">
          <ul className="grid grid-cols-4 gap-2">
            {photos.slice(0, PHOTO_LIMIT).map((photo) => (
              <li key={photo.image_id}>
                <button
                  type="button"
                  onClick={() => onZoom(photo)}
                  aria-label={
                    photo.caption
                      ? `Enlarge: ${plain(photo.caption)}`
                      : 'Enlarge photograph'
                  }
                  className="block aspect-square w-full cursor-zoom-in overflow-hidden border-2 border-transparent bg-fe-brown/20 transition hover:border-fe-accent focus-visible:border-fe-accent focus-visible:outline-none"
                >
                  <img
                    src={photo.src}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover object-top"
                  />
                </button>
              </li>
            ))}
          </ul>
          {photos.length > PHOTO_LIMIT && (
            <p className="mt-2 text-sm">
              <Link to={`/persons/${personId}/photos`} className={linkClass}>
                See all {photos.length} photographs of {firstName}
              </Link>
            </p>
          )}
        </Section>
      )}

      {writings.length > 0 && (
        <Section title={`Written by ${firstName}`}>
          <TextList texts={writings} />
        </Section>
      )}

      {texts.length > 0 && (
        <Section title={writings.length > 0 ? 'Other texts' : 'Texts'}>
          <TextList texts={texts} />
        </Section>
      )}

      {galleries.length > 0 && (
        <Section title="Galleries">
          <ShowMore
            items={galleries.map((gallery) => (
              <li key={gallery.gallery_id} className="flex items-center gap-2">
                {gallery.leadSrc && (
                  <img
                    src={gallery.leadSrc}
                    alt=""
                    loading="lazy"
                    className="h-8 w-8 shrink-0 object-cover object-top"
                  />
                )}
                <Link to={`/galleries/${gallery.gallery_id}`} className={linkClass}>
                  {gallery.name}
                </Link>
              </li>
            ))}
          />
        </Section>
      )}

      {collections.length > 0 && (
        <Section title="Collections">
          <ul className="space-y-1 text-sm">
            {collections.map((collection) => (
              <li key={collection.slug}>
                <Link to={`/collections/${collection.slug}`} className={linkClass}>
                  {collection.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className={sectionHeading}>{title}</h3>
      {children}
    </section>
  )
}

function TextList({ texts }: { texts: LinkedText[] }) {
  return (
    <ShowMore
      items={texts.map((text) => (
        <li key={text.document_id}>
          <Link to={`/documents/${text.document_id}`} className={linkClass}>
            <InlineMarkdown>{text.title}</InlineMarkdown>
          </Link>
        </li>
      ))}
    />
  )
}

// The first few, and a button for the rest -- in place, so the reader
// stays in the pop-up.
function ShowMore({ items }: { items: ReactNode[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, LIST_LIMIT)
  return (
    <>
      <ul className="space-y-1 text-sm">{shown}</ul>
      {items.length > LIST_LIMIT && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="mt-1 cursor-pointer text-sm text-fe-link hover:text-fe-link-dark"
        >
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </>
  )
}

function ZoomedPhoto({
  photo,
  backLabel,
  onBack,
}: {
  photo: LinkedPhoto
  backLabel: string
  onBack: () => void
}) {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex cursor-pointer items-center gap-1 text-sm text-fe-link hover:text-fe-link-dark"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {backLabel}
      </button>
      <img
        src={photo.src}
        alt={photo.caption ? plain(photo.caption) : ''}
        className="mx-auto max-h-[65vh] w-auto max-w-full object-contain"
      />
      {photo.caption && (
        <p className="mt-2 text-sm text-fe-ink/80">
          <InlineMarkdown>{photo.caption}</InlineMarkdown>
        </p>
      )}
    </div>
  )
}

// A caption's markdown, flattened for an aria-label or alt attribute.
function plain(markdown: string): string {
  return markdown.replace(/[*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
}

function Details({
  detail,
  currentFamilyId,
}: {
  detail: PersonDetail
  currentFamilyId: number | null
}) {
  // Every family page this person has, minus the one the reader is on.
  const otherFamilies = detail.familyIdsAsPartner.filter((id) => id !== currentFamilyId)
  // What to call those depends on where the reader is standing. On one
  // of this person's own family pages, anything left is another
  // marriage. On their parents' page (they're a child there), or a
  // page they're a grandparent on, those same links are simply their
  // family page(s) -- "other marriage" would be wrong, and confusing.
  const onOwnPage =
    currentFamilyId !== null && detail.familyIdsAsPartner.includes(currentFamilyId)
  const familyLabel = (index: number) => {
    const noun = onOwnPage ? 'other marriage' : 'family page'
    return otherFamilies.length > 1
      ? `${detail.first_name}’s ${noun} (${index + 1} of ${otherFamilies.length})`
      : `${detail.first_name}’s ${noun}`
  }
  const parentsFamily =
    detail.familyIdAsChild !== null && detail.familyIdAsChild !== currentFamilyId
      ? detail.familyIdAsChild
      : null

  return (
    <>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-fe-ink/60">Born</dt>
        <dd>{lifeEvent(detail.date_of_birth, detail.birth_year)}</dd>
        {(detail.date_of_death || detail.death_year) && (
          <>
            <dt className="text-fe-ink/60">Died</dt>
            <dd>{lifeEvent(detail.date_of_death, detail.death_year)}</dd>
          </>
        )}
      </dl>

      {(otherFamilies.length > 0 || parentsFamily !== null) && (
        <Section title="Family pages">
          <ul className="space-y-1 text-sm">
            {parentsFamily !== null && (
              <li>
                <Link to={`/family/${parentsFamily}`} className={linkClass}>
                  {detail.first_name}&rsquo;s parents
                </Link>
              </li>
            )}
            {otherFamilies.map((id, index) => (
              <li key={id}>
                <Link to={`/family/${id}`} className={linkClass}>
                  {familyLabel(index)}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

// A full date where the archive has one, the year alone where it only
// has that, and an honest blank otherwise -- never a made-up "January 1".
function lifeEvent(iso: string | null, year: number | null): string {
  if (iso) return formatDate(iso)
  if (year) return String(year)
  return 'unknown'
}
