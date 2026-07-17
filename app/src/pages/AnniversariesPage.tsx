import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ChevronButton from '../components/ChevronButton'
import Layout from '../components/Layout'
import { getAnniversaries } from '../data-access/gated/anniversaries'
import { useAuth } from '../hooks/useAuth'
import { AnniversaryEvent } from '../types/anniversary'
import { groupEventsByDay } from '../utils/anniversaryDisplay'
import {
  formatMonthDayHeading,
  getWeekday,
  MONTH_NAMES,
  parseIsoDate,
} from '../utils/dateDisplay'

const today = new Date()
const CURRENT_MONTH = today.getMonth() + 1
const CURRENT_DAY = today.getDate()

const EVENT_BORDER_COLOR: Record<AnniversaryEvent['type'], string> = {
  birth: 'border-fe-gen-child',
  death: 'border-fe-gen-death',
  marriage: 'border-fe-gen-couple',
}

function wrapMonth(month: number): number {
  return ((month - 1 + 12) % 12) + 1
}

function PersonLink({
  personId,
  linkedFamilyId,
  name,
}: {
  personId: number
  linkedFamilyId: number | null
  name: string
}) {
  const to =
    linkedFamilyId !== null ? `/family/${linkedFamilyId}` : `/persons/${personId}`
  return (
    <Link to={to} className="font-bold text-fe-accent hover:text-fe-accent-dark">
      {name}
    </Link>
  )
}

function EventRow({ event }: { event: AnniversaryEvent }) {
  const { year } = parseIsoDate(event.date)
  const weekday = getWeekday(event.date)

  return (
    <li className={`border-l-4 ${EVENT_BORDER_COLOR[event.type]} pl-3 py-1 text-sm`}>
      <span className="text-fe-ink/60 tabular-nums">{year}</span>{' '}
      {event.type === 'marriage' ? (
        <>
          <PersonLink
            personId={event.personId}
            linkedFamilyId={event.linkedFamilyId}
            name={event.personName}
          />{' '}
          and{' '}
          <PersonLink
            personId={event.spouseId as number}
            linkedFamilyId={event.linkedFamilyId}
            name={event.spouseName as string}
          />{' '}
          were married on a {weekday}
        </>
      ) : (
        <>
          <PersonLink
            personId={event.personId}
            linkedFamilyId={event.linkedFamilyId}
            name={event.personName}
          />{' '}
          {event.type === 'birth' ? 'was born' : 'died'} on a {weekday}
        </>
      )}
    </li>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; events: AnniversaryEvent[] }
  | { status: 'error' }

export default function AnniversariesPage() {
  const { idToken } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [month, setMonth] = useState(CURRENT_MONTH)
  const scrollTargetDay = useRef<number | null>(null)
  // Bumped on every "Jump to today" click, unconditionally -- setMonth
  // alone isn't enough to re-trigger the scroll effect below, because if
  // you're already viewing the current month (the page's own default),
  // setMonth(CURRENT_MONTH) is a same-value no-op and React skips the
  // re-render entirely, so an effect depending only on [month, state]
  // would never re-run and the scroll would silently do nothing.
  const [jumpSignal, setJumpSignal] = useState(0)

  useEffect(() => {
    if (!idToken) return
    let cancelled = false
    getAnniversaries(idToken)
      .then(({ events }) => {
        if (!cancelled) setState({ status: 'loaded', events })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [idToken])

  useEffect(() => {
    if (scrollTargetDay.current === null) return
    const day = scrollTargetDay.current
    scrollTargetDay.current = null
    document
      .getElementById(`day-${day}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [jumpSignal, month, state])

  function jumpToToday() {
    scrollTargetDay.current = CURRENT_DAY
    setMonth(CURRENT_MONTH)
    setJumpSignal((n) => n + 1)
  }

  const grouped: Map<number, AnniversaryEvent[]> =
    state.status === 'loaded' ? groupEventsByDay(state.events, month) : new Map()
  const days = [...grouped.keys()].sort((a, b) => a - b)

  return (
    <Layout>
      <div className="p-6 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {MONTH_NAMES[month - 1]} in Frau Erica
          </h1>
          <button
            type="button"
            onClick={jumpToToday}
            className="text-sm text-fe-accent hover:text-fe-accent-dark shrink-0"
          >
            Jump to today
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <ChevronButton
            direction="left"
            onClick={() => setMonth((m) => wrapMonth(m - 1))}
            label="Previous month"
            className="w-8 h-8 shrink-0"
          />
          <div className="flex flex-wrap gap-1">
            {MONTH_NAMES.map((name, i) => {
              const m = i + 1
              const isActive = m === month
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setMonth(m)}
                  className={`px-2 py-1 rounded-sm text-xs font-bold transition ${
                    isActive
                      ? 'bg-fe-accent text-white'
                      : 'bg-fe-brown/10 text-fe-brown hover:bg-fe-brown/20'
                  }`}
                >
                  {name.slice(0, 3)}
                </button>
              )
            })}
          </div>
          <ChevronButton
            direction="right"
            onClick={() => setMonth((m) => wrapMonth(m + 1))}
            label="Next month"
            className="w-8 h-8 shrink-0"
          />
        </div>

        {state.status === 'loading' && (
          <p className="text-fe-ink/60 text-sm">Loading...</p>
        )}
        {state.status === 'error' && (
          <p className="text-fe-ink/60 text-sm">
            Something went wrong loading anniversaries.
          </p>
        )}

        {state.status === 'loaded' && days.length === 0 && (
          <p className="text-fe-ink/60 text-sm">No known anniversaries this month.</p>
        )}

        {state.status === 'loaded' &&
          days.map((day) => (
            <section key={day} id={`day-${day}`} className="mb-5">
              <h2 className="font-bold text-sm text-fe-brown mb-2">
                {formatMonthDayHeading(month, day)}
              </h2>
              <ul className="space-y-1">
                {grouped.get(day)?.map((event) => (
                  <EventRow
                    key={`${event.type}-${event.personId}-${event.spouseId ?? ''}`}
                    event={event}
                  />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </Layout>
  )
}
