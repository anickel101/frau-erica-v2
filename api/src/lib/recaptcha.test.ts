import { describe, expect, test, vi } from 'vitest'
import { isVerificationAcceptable, verifyRecaptcha } from './recaptcha'

describe('isVerificationAcceptable', () => {
  test('true when success and score is above the default threshold', () => {
    expect(isVerificationAcceptable({ success: true, score: 0.9 })).toBe(true)
  })

  test('true exactly at the threshold boundary', () => {
    expect(isVerificationAcceptable({ success: true, score: 0.5 })).toBe(true)
  })

  test('false just below the threshold', () => {
    expect(isVerificationAcceptable({ success: true, score: 0.49 })).toBe(false)
  })

  test('false when success is false, regardless of score', () => {
    expect(isVerificationAcceptable({ success: false, score: 0.9 })).toBe(false)
  })

  test('false when score is missing -- fail closed, not treated as passing', () => {
    expect(isVerificationAcceptable({ success: true })).toBe(false)
  })

  test('respects a custom threshold', () => {
    expect(isVerificationAcceptable({ success: true, score: 0.6 }, 0.7)).toBe(false)
    expect(isVerificationAcceptable({ success: true, score: 0.6 }, 0.5)).toBe(true)
  })
})

describe('verifyRecaptcha', () => {
  test('posts the token and secret, returns the parsed response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, score: 0.8 }),
    })

    const result = await verifyRecaptcha('the-token', 'the-secret', fetchImpl)

    expect(result).toEqual({ success: true, score: 0.8 })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.google.com/recaptcha/api/siteverify',
      expect.objectContaining({
        method: 'POST',
        body: 'secret=the-secret&response=the-token',
      }),
    )
  })
})
