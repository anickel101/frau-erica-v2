// Manual split, not `new Date(iso)` -- the latter parses as UTC
// midnight, which renders as the previous day in any timezone behind
// UTC. Shared by every date helper below that needs the parts.
export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

export function formatDate(iso: string): string {
  const { year, month, day } = parseIsoDate(iso)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatBirthDate(iso?: string): string {
  return iso ? `Born ${formatDate(iso)}` : ''
}

// The actual historical day of week for this date (e.g. July 1 1851
// really was a Tuesday) -- computed from the date itself, nothing to
// store or fetch.
export function getWeekday(iso: string): string {
  const { year, month, day } = parseIsoDate(iso)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long' })
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// month is 1-12, matching AnniversaryEvent's month grouping convention.
export function formatMonthDayHeading(month: number, day: number): string {
  return `${MONTH_NAMES[month - 1]} ${day}`
}
