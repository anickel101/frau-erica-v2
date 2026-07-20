import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const getDbMock = vi.fn()
vi.mock('../lib/db', () => ({
  getDb: getDbMock,
}))

const { handler } = await import('./germline')

function fakeEvent(
  groupsClaim: string | undefined,
  personIdClaim?: string,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            'cognito:groups': groupsClaim,
            ...(personIdClaim !== undefined ? { 'custom:person_id': personIdClaim } : {}),
          },
          scopes: null,
        },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

beforeEach(() => {
  getDbMock.mockReset()
})

describe('germline handler authorization', () => {
  test('returns 403 for a pending-only user without touching the database', async () => {
    const result = (await handler(
      fakeEvent('[pending]', '3'),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(getDbMock).not.toHaveBeenCalled()
  })

  test('returns 403 when there is no groups claim at all', async () => {
    const result = (await handler(
      fakeEvent(undefined, '3'),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(getDbMock).not.toHaveBeenCalled()
  })
})

describe('germline handler with no linked person', () => {
  test('returns an empty germline without touching the database', async () => {
    const result = (await handler(
      fakeEvent('[approved]'),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body as string)).toEqual({
      personIds: [],
      ancestralLines: [],
    })
    expect(getDbMock).not.toHaveBeenCalled()
  })
})
