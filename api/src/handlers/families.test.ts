import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// getDb is a plain mock (not a throwing one) so the assertion below can
// prove the short-circuit directly via .not.toHaveBeenCalled(), rather
// than relying on an uncaught throw happening to propagate correctly.
const getDbMock = vi.fn()
vi.mock('../lib/db', () => ({
  getDb: getDbMock,
}))

const { handler } = await import('./families')

function fakeEvent(
  groupsClaim: string | undefined,
  id = '1',
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    pathParameters: { id },
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': groupsClaim }, scopes: null } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

beforeEach(() => {
  getDbMock.mockReset()
})

describe('families handler authorization', () => {
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
})
