import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const sendMock = vi.fn()
vi.mock('@aws-sdk/client-cognito-identity-provider', async () => {
  const actual = await vi.importActual<
    typeof import('@aws-sdk/client-cognito-identity-provider')
  >('@aws-sdk/client-cognito-identity-provider')
  return {
    ...actual,
    CognitoIdentityProviderClient: class {
      send = sendMock
    },
  }
})

const { handler } = await import('./adminUpdateUser')

function fakeEvent(
  groupsClaim: string | undefined,
  body: unknown,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    body: JSON.stringify(body),
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': groupsClaim }, scopes: null } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

beforeEach(() => {
  sendMock.mockReset()
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_test'
})

describe('adminUpdateUser handler', () => {
  test('403 for a non-admin user, Cognito never touched', async () => {
    const result = (await handler(
      fakeEvent('[approved]', { email: 'a@b.com', personId: 23 }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('400 when personId is missing or non-numeric', async () => {
    const result = (await handler(
      fakeEvent('[admin]', { email: 'a@b.com' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('updates custom:person_id for an admin caller', async () => {
    sendMock.mockResolvedValue({})
    const result = (await handler(
      fakeEvent('[admin]', { email: 'a@b.com', personId: 99 }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(1)
    const [command] = sendMock.mock.calls[0]
    expect(command.input.UserAttributes).toEqual([
      { Name: 'custom:person_id', Value: '99' },
    ])
  })
})
