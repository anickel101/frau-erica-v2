import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse } from './response'
import { withLogging } from './withLogging'

// This wrapper now sits in front of all twelve routes, so a bug in it is
// a bug in the whole API rather than in one handler. The cases below are
// the ones where that would actually hurt: swallowing a failure, or
// throwing from inside the logging itself.

function eventWith(claims?: Record<string, unknown>) {
  return {
    requestContext: claims ? { authorizer: { jwt: { claims } } } : undefined,
    pathParameters: { id: '42' },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('withLogging', () => {
  it('passes a successful response through untouched and logs nothing', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const body = { family: 'Michael' }

    return withLogging('families', () => Promise.resolve(jsonResponse(200, body)))(
      eventWith({ sub: 'abc' }),
    ).then((result) => {
      expect(result).toEqual(jsonResponse(200, body))
      // A per-request success line would multiply log volume to restate
      // what Lambda's own REPORT line already says.
      expect(log).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    })
  })

  it('rethrows a handler failure rather than converting it to a response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('snapshot unreadable')

    // The important half: a wrapper that logged and then returned would
    // turn a 500 into a silent success, which is strictly worse than no
    // logging at all.
    await expect(
      withLogging('families', () => Promise.reject(boom))(eventWith({ sub: 'abc' })),
    ).rejects.toThrow('snapshot unreadable')
  })

  it('records the caller and the error details on a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      withLogging('families', () => Promise.reject(new Error('snapshot unreadable')))(
        eventWith({ sub: 'user-sub-123' }),
      ),
    ).rejects.toThrow()

    const logged: unknown = JSON.parse(error.mock.calls[0][0] as string)
    expect(logged).toMatchObject({
      level: 'ERROR',
      event: 'request.failed',
      route: 'families',
      sub: 'user-sub-123',
      params: { id: '42' },
      errorName: 'Error',
      errorMessage: 'snapshot unreadable',
    })
  })

  it('logs a refusal with its status', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await withLogging('families', () =>
      Promise.resolve(jsonResponse(403, { error: 'nope' })),
    )(eventWith({ sub: 'abc' }))

    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({
      event: 'request.refused',
      status: 403,
    })
  })

  it('survives an event with no authorizer at all', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    // /request-access has no authorizer, and the handler tests construct
    // events with no requestContext whatsoever. Reading the caller must
    // never be what throws -- it runs on the path where a real error is
    // already being reported, and would mask it.
    await expect(
      withLogging('request-access', () => Promise.reject(new Error('real failure')))(
        eventWith(),
      ),
    ).rejects.toThrow('real failure')

    expect(JSON.parse(error.mock.calls[0][0] as string)).toMatchObject({
      event: 'request.failed',
      errorMessage: 'real failure',
    })
  })
})
