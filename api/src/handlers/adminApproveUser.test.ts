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

const { handler } = await import('./adminApproveUser')

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

describe('adminApproveUser handler authorization', () => {
  test('403 for an approved-only user, Cognito never touched', async () => {
    const result = (await handler(
      fakeEvent('[approved]', { email: 'a@b.com', personId: 1 }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('403 with no groups claim at all', async () => {
    const result = (await handler(
      fakeEvent(undefined, { email: 'a@b.com', personId: 1 }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(sendMock).not.toHaveBeenCalled()
  })
})

describe('adminApproveUser handler behavior', () => {
  test('400 when personId is missing or non-numeric', async () => {
    const result = (await handler(
      fakeEvent('[admin]', { email: 'a@b.com' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('creates the user then adds them to approved', async () => {
    sendMock.mockResolvedValue({})
    const result = (await handler(
      fakeEvent('[admin]', { email: 'a@b.com', personId: 23 }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  test('UsernameExistsException on create falls through to group-add instead of erroring', async () => {
    const { UsernameExistsException } =
      await import('@aws-sdk/client-cognito-identity-provider')
    sendMock
      .mockRejectedValueOnce(
        new UsernameExistsException({ message: 'exists', $metadata: {} }),
      )
      .mockResolvedValueOnce({})
    const result = (await handler(
      fakeEvent('[admin]', { email: 'a@b.com', personId: 23 }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(2)
  })
})
