import { describe, expect, it } from 'vitest'
import { formatLifespan } from './dateDisplay'

describe('formatLifespan', () => {
  it('renders a full range when both dates are known', () => {
    expect(formatLifespan('1865-01-01', '1923-12-16')).toBe(
      'January 1, 1865 – December 16, 1923',
    )
  })

  it('labels a birth-only date', () => {
    expect(formatLifespan('1906-01-01', undefined)).toBe('Born January 1, 1906')
  })

  it('labels a death-only date', () => {
    expect(formatLifespan(undefined, '1923-12-16')).toBe('Died December 16, 1923')
  })

  it('returns an empty string when neither date is known', () => {
    expect(formatLifespan(undefined, undefined)).toBe('')
  })
})
