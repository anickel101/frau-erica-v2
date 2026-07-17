import {
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider'
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

const { handler } = await import('./adminUpdateUserGroup')

function fakeEvent(
  groupsClaim: string | undefined,
  targetEmail: string,
  body: unknown,
  callerEmail = 'admin@example.com',
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    pathParameters: { email: targetEmail },
    body: JSON.stringify(body),
    requestContext: {
      authorizer: {
        jwt: {
          claims: { 'cognito:groups': groupsClaim, email: callerEmail },
          scopes: null,
        },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

beforeEach(() => {
  sendMock.mockReset()
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_test'
})

describe('adminUpdateUserGroup handler authorization', () => {
  test('403 for an approved-only user, Cognito never touched', async () => {
    const result = (await handler(
      fakeEvent('[approved]', 'someone@example.com', { action: 'promote' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('403 with no groups claim at all', async () => {
    const result = (await handler(
      fakeEvent(undefined, 'someone@example.com', { action: 'promote' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(sendMock).not.toHaveBeenCalled()
  })
})

describe('adminUpdateUserGroup handler behavior', () => {
  test('400 when the target email is the caller themselves, Cognito never touched', async () => {
    const result = (await handler(
      fakeEvent(
        '[admin]',
        'admin@example.com',
        { action: 'demote' },
        'admin@example.com',
      ),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('400 for a missing/invalid action, Cognito never touched', async () => {
    const result = (await handler(
      fakeEvent('[admin]', 'someone@example.com', { action: 'delete' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('promote adds the admin group', async () => {
    sendMock.mockResolvedValue({})
    const result = (await handler(
      fakeEvent('[admin]', 'someone@example.com', { action: 'promote' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(AdminAddUserToGroupCommand)
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Username: 'someone@example.com',
      GroupName: 'admin',
    })
  })

  test('demote removes the admin group', async () => {
    sendMock.mockResolvedValue({})
    const result = (await handler(
      fakeEvent('[admin]', 'someone@example.com', { action: 'demote' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(AdminRemoveUserFromGroupCommand)
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Username: 'someone@example.com',
      GroupName: 'admin',
    })
  })
})
