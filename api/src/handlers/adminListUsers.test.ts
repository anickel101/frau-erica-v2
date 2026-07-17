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

// Real in-memory DB (same fixtures every queries/*.test.ts uses), not a
// mocked query layer -- proves the actual SQL against the actual schema.
// Persons 1-10 are seeded; person_id 3 is Anna Mueller (see testFixtures.ts).
vi.mock('../lib/db', async () => {
  const { createTestDb, seedFixtures } = await import('../lib/testFixtures')
  const db = await createTestDb()
  await seedFixtures(db)
  return { getDb: async () => db }
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

// LISTED_GROUPS iterates [pending, approved, admin] -- every test below
// mocks calls in that order.

test('merges a user appearing in both approved and admin into one entry', async () => {
  sendMock
    .mockResolvedValueOnce({ Users: [] }) // pending
    .mockResolvedValueOnce({
      Users: [
        {
          Attributes: [
            { Name: 'email', Value: 'a@b.com' },
            // Doesn't match any seeded person -- fullName should fall
            // back to null rather than error.
            { Name: 'custom:person_id', Value: '999' },
          ],
        },
      ],
    }) // approved
    .mockResolvedValueOnce({
      Users: [{ Attributes: [{ Name: 'email', Value: 'a@b.com' }] }],
    }) // admin

  const result = (await handler(
    fakeEvent('[admin]'),
  )) as APIGatewayProxyStructuredResultV2
  const body = JSON.parse(result.body as string)

  expect(body.users).toEqual([
    {
      email: 'a@b.com',
      groups: ['approved', 'admin'],
      personId: 999,
      fullName: null,
      requesterName: null,
      connection: null,
    },
  ])
})

test('resolves fullName via the linked person_id', async () => {
  sendMock
    .mockResolvedValueOnce({ Users: [] }) // pending
    .mockResolvedValueOnce({
      Users: [
        {
          Attributes: [
            { Name: 'email', Value: 'anna@example.com' },
            { Name: 'custom:person_id', Value: '3' },
          ],
        },
      ],
    }) // approved
    .mockResolvedValueOnce({ Users: [] }) // admin

  const result = (await handler(
    fakeEvent('[admin]'),
  )) as APIGatewayProxyStructuredResultV2
  const body = JSON.parse(result.body as string)

  expect(body.users[0].fullName).toBe('Anna Mueller')
})

test('surfaces requesterName/connection for a pending user', async () => {
  sendMock
    .mockResolvedValueOnce({
      Users: [
        {
          Attributes: [
            { Name: 'email', Value: 'jane@example.com' },
            { Name: 'custom:requester_name', Value: 'Jane Smith' },
            { Name: 'custom:connection', Value: 'Great-granddaughter of Georg' },
          ],
        },
      ],
    }) // pending
    .mockResolvedValueOnce({ Users: [] }) // approved
    .mockResolvedValueOnce({ Users: [] }) // admin

  const result = (await handler(
    fakeEvent('[admin]'),
  )) as APIGatewayProxyStructuredResultV2
  const body = JSON.parse(result.body as string)

  expect(body.users).toEqual([
    {
      email: 'jane@example.com',
      groups: ['pending'],
      personId: null,
      fullName: null,
      requesterName: 'Jane Smith',
      connection: 'Great-granddaughter of Georg',
    },
  ])
})

test('follows NextToken pagination within a single group', async () => {
  sendMock
    .mockResolvedValueOnce({ Users: [] }) // pending
    .mockResolvedValueOnce({
      Users: [{ Attributes: [{ Name: 'email', Value: 'page1@b.com' }] }],
      NextToken: 'token-1',
    }) // approved, page 1
    .mockResolvedValueOnce({
      Users: [{ Attributes: [{ Name: 'email', Value: 'page2@b.com' }] }],
    }) // approved, page 2
    .mockResolvedValueOnce({ Users: [] }) // admin

  const result = (await handler(
    fakeEvent('[admin]'),
  )) as APIGatewayProxyStructuredResultV2
  const body = JSON.parse(result.body as string)

  expect(body.users.map((u: { email: string }) => u.email)).toEqual([
    'page1@b.com',
    'page2@b.com',
  ])
})
