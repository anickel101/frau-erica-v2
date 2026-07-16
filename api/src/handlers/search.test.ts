import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../lib/db', () => ({
  getDb: vi.fn(() => {
    throw new Error('getDb should not be called for an unapproved request')
  }),
}))

const { handler } = await import('./search')

function fakeEvent(
  groupsClaim: string | undefined,
  q = 'mueller',
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    queryStringParameters: { q },
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': groupsClaim }, scopes: null } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

describe('search handler authorization', () => {
  test('returns 403 for a pending-only user without touching the database', async () => {
    const result = (await handler(
      fakeEvent('[pending]'),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
  })

  test('returns 403 when there is no groups claim at all', async () => {
    const result = (await handler(
      fakeEvent(undefined),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
  })
})
