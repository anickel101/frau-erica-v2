import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Same shape as persons.test.ts: getDb is a plain mock so the assertion
// proves the short-circuit directly via .not.toHaveBeenCalled(), rather
// than relying on an uncaught throw propagating.
const getDbMock = vi.fn()
vi.mock('../lib/db', () => ({
  getDb: getDbMock,
}))

const { handler } = await import('./recipes')

function fakeEvent(
  groupsClaim: string | undefined,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    pathParameters: { slug: 'blueberry-buckle' },
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': groupsClaim }, scopes: null } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

beforeEach(() => {
  getDbMock.mockReset()
})

describe('recipes handler authorization', () => {
  test('returns 403 for a pending-only user without touching the database', async () => {
    const result = (await handler(
      fakeEvent('[pending]'),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(getDbMock).not.toHaveBeenCalled()
  })

  test('returns 403 when there is no groups claim at all', async () => {
    const result = (await handler(
      fakeEvent(undefined),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(getDbMock).not.toHaveBeenCalled()
  })

  // The cookbook is gated to 'approved' like every other gated route.
  // An admin is also approved, so both groups must pass the guard.
  test('lets an approved user through to the database', async () => {
    getDbMock.mockRejectedValue(new Error('db reached'))
    await expect(handler(fakeEvent('[approved]'))).rejects.toThrow('db reached')
    expect(getDbMock).toHaveBeenCalled()
  })
})
