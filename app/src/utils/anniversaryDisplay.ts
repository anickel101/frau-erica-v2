import { AnniversaryEvent } from '../types/anniversary'
import { parseIsoDate } from './dateDisplay'

// Filters the full event list down to one month and groups by
// day-of-month, sorted within each day by year ascending (earliest
// first) -- matches the original site's chronological-within-day
// ordering. Pure and unit-tested since the page itself fetches the
// full year once and re-groups client-side on every month change.
export function groupEventsByDay(
  events: AnniversaryEvent[],
  month: number,
): Map<number, AnniversaryEvent[]> {
  const byDay = new Map<number, AnniversaryEvent[]>()

  for (const event of events) {
    const parts = parseIsoDate(event.date)
    if (parts.month !== month) continue
    const existing = byDay.get(parts.day)
    if (existing) {
      existing.push(event)
    } else {
      byDay.set(parts.day, [event])
    }
  }

  for (const dayEvents of byDay.values()) {
    dayEvents.sort((a, b) => parseIsoDate(a.date).year - parseIsoDate(b.date).year)
  }

  return byDay
}
