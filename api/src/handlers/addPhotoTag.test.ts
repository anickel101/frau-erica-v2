import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const putPhotoTag = vi.fn()
vi.mock('../lib/photoTags', () => ({ putPhotoTag }))

// The archive snapshot, stubbed: these tests are about the handler's
// guards, not about sql.js. personExists/imageIsInGallery are exercised
// against real SQL in queries/photoTagTargets.test.ts.
const personExists = vi.fn(() => true)
const imageIsInGallery = vi.fn(() => true)
vi.mock('../lib/queries/photoTagTargets', () => ({
  personExists,
  imageIsInGallery,
  HEADER_IMAGES_GROUP: -1,
  MISCELLANEOUS_GROUP: -2,
}))
vi.mock('../lib/db', () => ({ getDb: async () => ({}) }))

const { handler } = await import('./addPhotoTag')

function fakeEvent(
  body: unknown,
  { groups = 'admin', email = 'admin@example.com' } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': `[${groups}]`, email } } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

const valid = { image_id: 500, person_id: 23, gallery_id: 12 }

async function call(...args: Parameters<typeof fakeEvent>) {
  return (await handler(fakeEvent(...args))) as APIGatewayProxyStructuredResultV2
}

describe('POST /photo-tags', () => {
  beforeEach(() => {
    putPhotoTag.mockReset()
    personExists.mockReset().mockReturnValue(true)
    imageIsInGallery.mockReset().mockReturnValue(true)
  })

  test('records a tag for an admin', async () => {
    const res = await call(valid)
    expect(res.statusCode).toBe(200)
    expect(putPhotoTag).toHaveBeenCalledWith(
      expect.objectContaining({ image_id: 500, person_id: 23, gallery_id: 12 }),
    )
  })

  // Provenance is the first thing anyone will want from a tag that looks
  // wrong months later.
  test('stamps who tagged it and when', async () => {
    await call(valid, { email: 'dad@example.com' })
    const [tag] = putPhotoTag.mock.calls[0]
    expect(tag.tagged_by).toBe('dad@example.com')
    expect(Date.parse(tag.tagged_at)).not.toBeNaN()
  })

  // Hiding the page behind RequireAdmin in the browser is a convenience,
  // not a control. This is the control.
  test.each([['approved'], ['pending'], ['']])(
    'refuses a caller in group "%s"',
    async (groups) => {
      putPhotoTag.mockRejectedValue(new Error('must not be called'))
      const res = await call(valid, { groups })
      expect(res.statusCode).toBe(403)
      expect(putPhotoTag).not.toHaveBeenCalled()
    },
  )

  // JSON will happily carry any of these into a field typed number, and
  // each would reach DynamoDB as a key no later query could match.
  test.each([
    ['a float', { ...valid, image_id: 12.5 }],
    ['a numeric string', { ...valid, person_id: '23' }],
    ['zero', { ...valid, gallery_id: 0 }],
    ['a negative image_id', { ...valid, image_id: -1 }],
    ['a missing field', { image_id: 500, person_id: 23 }],
  ])('rejects %s', async (_label, body) => {
    const res = await call(body)
    expect(res.statusCode).toBe(400)
    expect(putPhotoTag).not.toHaveBeenCalled()
  })

  test('rejects a malformed body', async () => {
    const res = await call('{ not json')
    expect(res.statusCode).toBe(400)
    expect(putPhotoTag).not.toHaveBeenCalled()
  })

  // A tag naming a person who doesn't exist produces no error anywhere
  // once it is stored -- it just sits there looking like data until
  // someone tries to apply it, by which point the intent is unknowable.
  test('refuses a person who does not exist', async () => {
    personExists.mockReturnValue(false)
    const res = await call(valid)
    expect(res.statusCode).toBe(404)
    expect(putPhotoTag).not.toHaveBeenCalled()
  })

  // Filed under the wrong gallery, a tag is invisible to the by-gallery
  // index the page reads -- present in the table, absent from every view.
  test('refuses an image that is not in the stated gallery', async () => {
    imageIsInGallery.mockReturnValue(false)
    const res = await call(valid)
    expect(res.statusCode).toBe(404)
    expect(putPhotoTag).not.toHaveBeenCalled()
  })

  // The two synthetic groups are negative on purpose, so the plain
  // "positive integer" rule would have rejected every tag on a header
  // image or an uncategorised one.
  test.each([[-1], [-2]])('accepts the synthetic group %i', async (galleryId) => {
    const res = await call({ ...valid, gallery_id: galleryId })
    expect(res.statusCode).toBe(200)
    expect(putPhotoTag).toHaveBeenCalledWith(
      expect.objectContaining({ gallery_id: galleryId }),
    )
  })

  test('still rejects a group id that means nothing', async () => {
    const res = await call({ ...valid, gallery_id: -99 })
    expect(res.statusCode).toBe(400)
    expect(putPhotoTag).not.toHaveBeenCalled()
  })

  // (image, person) is the key, so this is an overwrite. Tapping a name
  // twice is not a mistake to report.
  test('treats a repeat tag as success', async () => {
    expect((await call(valid)).statusCode).toBe(200)
    expect((await call(valid)).statusCode).toBe(200)
  })
})
