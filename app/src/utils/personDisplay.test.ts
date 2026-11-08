import { describe, expect, it } from 'vitest'
import { matchesWords } from './personDisplay'

describe('matchesWords', () => {
  it('matches first and last name across a middle name', () => {
    expect(matchesWords('Mark Mueller Nickel', 'mark nickel')).toBe(true)
  })

  it('matches words in any order, case-insensitively', () => {
    expect(matchesWords('Mark Mueller Nickel', 'NICKEL mark')).toBe(true)
  })

  it('needs every word', () => {
    expect(matchesWords('Mark Mueller Nickel', 'mark knief')).toBe(false)
  })

  it('matches nothing for an empty query', () => {
    expect(matchesWords('Mark Mueller Nickel', '   ')).toBe(false)
  })
})
