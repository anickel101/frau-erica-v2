// The Mueller family's arrival in New York harbor -- the reference point
// for the sidebar logo's "The First N Years" line. The old site hardcoded
// this number by hand and needed a manual yearly update; computed here
// instead so it's always correct, ticking over on the anniversary itself
// (October 2) rather than on January 1st.
const ARRIVAL_YEAR = 1865
const ARRIVAL_MONTH = 9 // October, 0-indexed
const ARRIVAL_DAY = 2

export function getYearsSinceArrival(now: Date = new Date()): number {
  let years = now.getFullYear() - ARRIVAL_YEAR
  const hadAnniversaryThisYear =
    now.getMonth() > ARRIVAL_MONTH ||
    (now.getMonth() === ARRIVAL_MONTH && now.getDate() >= ARRIVAL_DAY)
  if (!hadAnniversaryThisYear) years -= 1
  return years
}
