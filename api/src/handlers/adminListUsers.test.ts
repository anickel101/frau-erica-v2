import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, expect, test, vi } from 'vitest'

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

const { handler } = await import('./adminListUsers')

function fakeEvent(
  groupsClaim: string | undefined,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': groupsClaim }, scopes: null } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

beforeEach(() => {
  sendMock.mockReset()
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_test'
})

test('403 for a non-admin user, Cognito never touched', async () => {
  const result = (await handler(
    fakeEvent('[approved]'),
  )) as APIGatewayProxyStructuredResultV2
  expect(result.statusCode).toBe(403)
  expect(sendMock).not.toHaveBeenCalled()
})

test('merges a user appearing in both approved and admin into one entry', async () => {
  sendMock
    .mockResolvedValueOnce({
      Users: [
        {
          Attributes: [
            { Name: 'email', Value: 'a@b.com' },
            { Name: 'custom:person_id', Value: '23' },
          ],
        },
      ],
    })
    .mockResolvedValueOnce({
      Users: [{ Attributes: [{ Name: 'email', Value: 'a@b.com' }] }],
    })

  const result = (await handler(
    fakeEvent('[admin]'),
  )) as APIGatewayProxyStructuredResultV2
  const body = JSON.parse(result.body as string)

  expect(body.users).toEqual([
    { email: 'a@b.com', groups: ['approved', 'admin'], personId: 23 },
  ])
})

test('follows NextToken pagination within a single group', async () => {
  sendMock
    .mockResolvedValueOnce({
      Users: [{ Attributes: [{ Name: 'email', Value: 'page1@b.com' }] }],
      NextToken: 'token-1',
    })
    .mockResolvedValueOnce({
      Users: [{ Attributes: [{ Name: 'email', Value: 'page2@b.com' }] }],
    })
    .mockResolvedValueOnce({ Users: [] })

  const result = (await handler(
    fakeEvent('[admin]'),
  )) as APIGatewayProxyStructuredResultV2
  const body = JSON.parse(result.body as string)

  expect(body.users.map((u: { email: string }) => u.email)).toEqual([
    'page1@b.com',
    'page2@b.com',
  ])
})
