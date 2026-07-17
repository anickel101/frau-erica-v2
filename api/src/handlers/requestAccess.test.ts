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

const { handler } = await import('./requestAccess')

function fakeEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as unknown as APIGatewayProxyEventV2
}

beforeEach(() => {
  getRecaptchaSecretMock.mockReset().mockResolvedValue('the-secret')
  verifyRecaptchaMock.mockReset()
  sendAdminNotificationMock.mockReset()
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173'
})

describe('requestAccess handler', () => {
  test('400 when a required field is missing, recaptcha and SES never called', async () => {
    const result = (await handler(
      fakeEvent({ name: 'Jane', email: 'jane@example.com' }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(400)
    expect(verifyRecaptchaMock).not.toHaveBeenCalled()
    expect(sendAdminNotificationMock).not.toHaveBeenCalled()
  })

  test('400 when recaptcha is rejected, SES never called', async () => {
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
    expect(sendAdminNotificationMock).not.toHaveBeenCalled()
  })

  test('200 and sends the notification when recaptcha passes', async () => {
    verifyRecaptchaMock.mockResolvedValue({ success: true, score: 0.9 })
    const result = (await handler(
      fakeEvent({
        name: 'Jane',
        email: 'jane@example.com',
        connection: 'x',
        recaptchaToken: 't',
      }),
    )) as APIGatewayProxyStructuredResultV2
    expect(result.statusCode).toBe(200)
    expect(sendAdminNotificationMock).toHaveBeenCalledTimes(1)
  })
})
