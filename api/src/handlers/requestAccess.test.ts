import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const getRecaptchaSecretMock = vi.fn()
vi.mock('../lib/secrets', () => ({
  getRecaptchaSecret: () => getRecaptchaSecretMock(),
}))

const verifyRecaptchaMock = vi.fn()
vi.mock('../lib/recaptcha', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/recaptcha')>('../lib/recaptcha')
  return {
    ...actual,
    verifyRecaptcha: (...args: unknown[]) => verifyRecaptchaMock(...args),
  }
})

const sendAdminNotificationMock = vi.fn()
vi.mock('../lib/ses', () => ({
  sendAdminNotification: (...args: unknown[]) => sendAdminNotificationMock(...args),
}))

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

const { handler } = await import('./requestAccess')

function fakeEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as unknown as APIGatewayProxyEventV2
}

beforeEach(() => {
  getRecaptchaSecretMock.mockReset().mockResolvedValue('the-secret')
  verifyRecaptchaMock.mockReset()
  sendAdminNotificationMock.mockReset()
  sendMock.mockReset()
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173'
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_test'
})

describe('requestAccess handler', () => {
  test('400 when a required field is missing, recaptcha/Cognito/SES never called', async () => {
    const result = (await handler(
      fakeEvent({ name: 'Jane', email: 'jane@example.com' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(verifyRecaptchaMock).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
    expect(sendAdminNotificationMock).not.toHaveBeenCalled()
  })

  test('400 when recaptcha is rejected, Cognito/SES never called', async () => {
    verifyRecaptchaMock.mockResolvedValue({ success: true, score: 0.1 })
    const result = (await handler(
      fakeEvent({
        name: 'Jane',
        email: 'jane@example.com',
        connection: 'x',
        recaptchaToken: 't',
      }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(sendMock).not.toHaveBeenCalled()
    expect(sendAdminNotificationMock).not.toHaveBeenCalled()
  })

  test('200, creates a pending account, and sends the notification', async () => {
    verifyRecaptchaMock.mockResolvedValue({ success: true, score: 0.9 })
    sendMock.mockResolvedValue({})
    const result = (await handler(
      fakeEvent({
        name: 'Jane',
        email: 'jane@example.com',
        connection: 'x',
        recaptchaToken: 't',
      }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(AdminCreateUserCommand)
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Username: 'jane@example.com',
      MessageAction: 'SUPPRESS',
    })
    expect(sendMock.mock.calls[1][0]).toBeInstanceOf(AdminAddUserToGroupCommand)
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      Username: 'jane@example.com',
      GroupName: 'pending',
    })
    expect(sendAdminNotificationMock).toHaveBeenCalledTimes(1)
  })

  test('a duplicate request self-heals instead of erroring, still notifies', async () => {
    const { UsernameExistsException } =
      await import('@aws-sdk/client-cognito-identity-provider')
    verifyRecaptchaMock.mockResolvedValue({ success: true, score: 0.9 })
    sendMock.mockRejectedValueOnce(
      new UsernameExistsException({ message: 'exists', $metadata: {} }),
    )
    const result = (await handler(
      fakeEvent({
        name: 'Jane',
        email: 'jane@example.com',
        connection: 'x',
        recaptchaToken: 't',
      }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    // Only the AdminCreateUserCommand attempt -- AdminAddUserToGroup is
    // never reached, so an already-approved user re-submitting can't be
    // silently added back to pending.
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendAdminNotificationMock).toHaveBeenCalledTimes(1)
  })
})
