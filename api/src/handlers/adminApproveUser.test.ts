import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
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

  test('no prior request: creates the user fresh then adds them to approved', async () => {
    const { UserNotFoundException } =
      await import('@aws-sdk/client-cognito-identity-provider')
    sendMock
      .mockRejectedValueOnce(
        new UserNotFoundException({ message: 'not found', $metadata: {} }),
      ) // AdminGetUserCommand -- doesn't exist
      .mockResolvedValueOnce({}) // AdminCreateUserCommand (fresh)
      .mockResolvedValueOnce({}) // AdminAddUserToGroupCommand

    const result = (await handler(
      fakeEvent('[admin]', { email: 'a@b.com', personId: 23 }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(3)
    expect(sendMock.mock.calls[1][0]).toBeInstanceOf(AdminCreateUserCommand)
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      Username: 'a@b.com',
      DesiredDeliveryMediums: ['EMAIL'],
    })
    expect(sendMock.mock.calls[2][0]).toBeInstanceOf(AdminAddUserToGroupCommand)
    expect(sendMock.mock.calls[2][0].input).toMatchObject({ GroupName: 'approved' })
  })

  test('existing pending request: sets person_id, resends invite, moves pending to approved', async () => {
    sendMock.mockResolvedValue({}) // AdminGetUserCommand resolves -- user exists

    const result = (await handler(
      fakeEvent('[admin]', { email: 'a@b.com', personId: 23 }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(5)
    expect(sendMock.mock.calls[1][0]).toBeInstanceOf(AdminUpdateUserAttributesCommand)
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      UserAttributes: [{ Name: 'custom:person_id', Value: '23' }],
    })
    expect(sendMock.mock.calls[2][0]).toBeInstanceOf(AdminCreateUserCommand)
    expect(sendMock.mock.calls[2][0].input).toMatchObject({ MessageAction: 'RESEND' })
    // ORDER MATTERS, and this assertion is the whole point of pinning it.
    //
    // These two used to run the other way round. If the add then failed
    // -- a throttle, a transient 5xx -- the account belonged to no group
    // at all, and adminListUsers enumerates membership group by group,
    // so the person being approved vanished from the admin table: not
    // pending, not approved, not deletable from the UI. In this order a
    // half-failure leaves them in both groups, which hasApprovedAccess
    // already accepts and the list still shows.
    expect(sendMock.mock.calls[3][0]).toBeInstanceOf(AdminAddUserToGroupCommand)
    expect(sendMock.mock.calls[3][0].input).toMatchObject({ GroupName: 'approved' })
    expect(sendMock.mock.calls[4][0]).toBeInstanceOf(AdminRemoveUserFromGroupCommand)
    expect(sendMock.mock.calls[4][0].input).toMatchObject({ GroupName: 'pending' })
  })

  // The failure the ordering exists to survive.
  test('a failed group add leaves them still pending, not in limbo', async () => {
    // userExists goes through the same sendMock (AdminGetUserCommand),
    // so the sequence is: 1 the existence check, 2 the attribute write,
    // 3 the RESEND, 4 the group add -- which fails here.
    let call = 0
    sendMock.mockImplementation(() => {
      call += 1
      if (call === 4) throw new Error('TooManyRequestsException')
      return {}
    })

    await expect(
      handler(fakeEvent('[admin]', { email: 'a@b.com', personId: 23 })),
    ).rejects.toThrow('TooManyRequestsException')

    // Nothing removed them from pending, so they are still visible to
    // the admin list and the approval can simply be retried.
    const removals = sendMock.mock.calls.filter(
      (c) => c[0] instanceof AdminRemoveUserFromGroupCommand,
    )
    expect(removals).toHaveLength(0)
  })
})
