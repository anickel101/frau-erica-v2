import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import Modal from './Modal'
import { getPersonById } from '../data-access/gated/persons'
import { LinkedPersonSummary, PersonDetail } from '../types/person'
import { formatDate } from '../utils/dateDisplay'
import { getFullName } from '../utils/personDisplay'
import { buttonClassName } from '../utils/formStyles'

type LoadState =
  { kind: 'loading' } | { kind: 'ready'; detail: PersonDetail } | { kind: 'error' }

// The "More info" pop-up for one person on a Family page.
//
// The box only carries a LinkedPersonSummary -- name, dates, and the one
// family page it links to -- so the rest is fetched on open from
// GET /persons/:id, which is where the full record already lives. The
// fetch is per open rather than cached: a pop-up is read once and
// dismissed, and the API's own warm-Lambda path answers in tens of
// milliseconds.
//
// Two ways out, per the spec: an X at the top right, which is the
// convention people reach for first, and a labelled Close button at the
// bottom right, which is the one a screen reader lands on last and a
// keyboard user tabs to naturally. Escape and the backdrop also close
// it -- Modal handles both.
export default function PersonInfoDialog({
  person,
  currentFamilyId,
  open,
  onClose,
}: {
  person: LinkedPersonSummary
  // The family page the dialog was opened from, so "their family page"
  // isn't offered as a link to where the reader already is.
  currentFamilyId: number | null
  open: boolean
  onClose: () => void
}) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  // Back to "loading" each time the dialog opens, so a second open
  // doesn't flash the previous person's details while the new fetch is
  // in flight. Done as a render-time reset (the same shape
  // usePaginatedSearch uses) rather than a setState at the top of the
  // effect, which React flags as a cascading render.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setState({ kind: 'loading' })
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

  return (
    <Modal open={open} onClose={onClose} label={`About ${name}`}>
      {/* stopPropagation, same as AdminUsersPage's dialogs: Modal closes
          on any click by default (its image-zoom callers want that), and
          a pop-up full of links must not vanish when someone clicks the
          whitespace beside one. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-sm bg-fe-bg p-6 pt-5 shadow-lg"
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

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={buttonClassName}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
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
      ? `${detail.first_name}\u2019s ${noun} (${index + 1} of ${otherFamilies.length})`
      : `${detail.first_name}\u2019s ${noun}`
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
        <div className="mt-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-fe-brown">
            On this site
          </p>
          <ul className="space-y-1 text-sm">
            {parentsFamily !== null && (
              <li>
                <Link
                  to={`/family/${parentsFamily}`}
                  className="text-fe-link hover:text-fe-link-dark"
                >
                  {detail.first_name}&rsquo;s parents
                </Link>
              </li>
            )}
            {otherFamilies.map((id, index) => (
              <li key={id}>
                <Link
                  to={`/family/${id}`}
                  className="text-fe-link hover:text-fe-link-dark"
                >
                  {familyLabel(index)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-fe-ink/50">Person no. {detail.person_id}</p>
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
