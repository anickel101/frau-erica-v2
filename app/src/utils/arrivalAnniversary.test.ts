import { describe, expect, it } from 'vitest'
import { getYearsSinceArrival } from './arrivalAnniversary'

describe('getYearsSinceArrival', () => {
  it('counts a full year once the anniversary date has passed this year', () => {
    expect(getYearsSinceArrival(new Date(2026, 9, 2))).toBe(161) // on the day itself
    expect(getYearsSinceArrival(new Date(2026, 9, 15))).toBe(161)
  })

  it('has not yet incremented before the anniversary date this year', () => {
    expect(getYearsSinceArrival(new Date(2026, 6, 29))).toBe(160) // July, before October
    expect(getYearsSinceArrival(new Date(2026, 9, 1))).toBe(160) // the day before
  })
})
