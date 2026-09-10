import {
  AdminDeleteUserCommand,
  AdminListGroupsForUserCommand,
  UserNotFoundException,
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

const { handler } = await import('./adminDeleteUser')

function fakeEvent(
  email: string,
  { groups = 'admin', callerEmail = 'admin@example.com' } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    pathParameters: { email },
    requestContext: {
      authorizer: {
        jwt: { claims: { 'cognito:groups': `[${groups}]`, email: callerEmail } },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

// Groups lookup first, delete second -- mirrors the handler's order.
function mockGroups(...names: string[]) {
  sendMock.mockImplementation((command: unknown) => {
    if (command instanceof AdminListGroupsForUserCommand) {
      return Promise.resolve({ Groups: names.map((GroupName) => ({ GroupName })) })
    }
    return Promise.resolve({})
  })
}

beforeEach(() => {
  sendMock.mockReset()
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_test'
})

describe('adminDeleteUser handler', () => {
  // The most important test on any admin handler in this project: prove
  // the guard short-circuits before any AWS call, not merely that the
  // status code is right.
  test('403 for a non-admin caller, and Cognito is never touched', async () => {
    sendMock.mockRejectedValue(new Error('must not be called'))
    const result = (await handler(
      fakeEvent('someone@example.com', { groups: 'approved' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(403)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('deletes a pending user', async () => {
    mockGroups('pending')
    const result = (await handler(
      fakeEvent('spam@example.com'),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    const deletes = sendMock.mock.calls.filter(
      ([c]) => c instanceof AdminDeleteUserCommand,
    )
    expect(deletes).toHaveLength(1)
  })

  test('refuses to delete an admin, and does not call delete', async () => {
    mockGroups('approved', 'admin')
    const result = (await handler(
      fakeEvent('other-admin@example.com'),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(
      sendMock.mock.calls.filter(([c]) => c instanceof AdminDeleteUserCommand),
    ).toHaveLength(0)
  })

  test('refuses self-deletion before any lookup happens', async () => {
    sendMock.mockRejectedValue(new Error('must not be called'))
    const result = (await handler(
      fakeEvent('admin@example.com', { callerEmail: 'admin@example.com' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(sendMock).not.toHaveBeenCalled()
  })

  // This pool has case-insensitive usernames, so differing capitalization
  // is the same account -- a raw === comparison let an admin delete
  // themselves by varying the case of what they typed.
  test('self-deletion guard ignores capitalization', async () => {
    sendMock.mockRejectedValue(new Error('must not be called'))
    const result = (await handler(
      fakeEvent('Admin@Example.com', { callerEmail: 'admin@example.com' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(sendMock).not.toHaveBeenCalled()
  })

  // A double click, or a second admin acting on a stale page, shouldn't
  // surface an error for an outcome that already happened.
  test('an already-deleted user reports success', async () => {
    sendMock.mockRejectedValue(
      new UserNotFoundException({ message: 'gone', $metadata: {} }),
    )
    const result = (await handler(
      fakeEvent('ghost@example.com'),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
  })
})
