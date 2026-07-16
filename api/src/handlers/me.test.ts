import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { describe, expect, test } from 'vitest'
import { handler } from './me'

function fakeEvent(
  claims: Record<string, string>,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    requestContext: { authorizer: { jwt: { claims, scopes: null } } },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

describe('me handler', () => {
  test('parses custom:person_id into a number', async () => {
    const result = await handler(
      fakeEvent({
        sub: 'abc-123',
        email: 'a@b.com',
        'cognito:groups': '[admin]',
        'custom:person_id': '23',
      }),
    )
    const body = JSON.parse((result as APIGatewayProxyStructuredResultV2).body as string)
    expect(body).toEqual({
      sub: 'abc-123',
      email: 'a@b.com',
      groups: '[admin]',
      personId: 23,
    })
  })

  test('personId is null when the claim is absent', async () => {
    const result = await handler(fakeEvent({ sub: 'abc-123', email: 'a@b.com' }))
    const body = JSON.parse((result as APIGatewayProxyStructuredResultV2).body as string)
    expect(body.personId).toBeNull()
    expect(body.groups).toBeNull()
  })
})
