import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const deletePhotoTag = vi.fn()
const listPhotoTagsForGallery = vi.fn(async () => [])
const listAllPhotoTags = vi.fn(async () => [])
vi.mock('../lib/photoTags', () => ({
  deletePhotoTag,
  listPhotoTagsForGallery,
  listAllPhotoTags,
}))

const { handler: del } = await import('./deletePhotoTag')
const { handler: list } = await import('./listPhotoTags')

function event(
  parts: Partial<{
    pathParameters: Record<string, string>
    queryStringParameters: Record<string, string>
    groups: string
  }>,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    pathParameters: parts.pathParameters,
    queryStringParameters: parts.queryStringParameters,
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            'cognito:groups': `[${parts.groups ?? 'admin'}]`,
            email: 'admin@example.com',
          },
        },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

const run = async (h: typeof del, e: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  (await h(e)) as APIGatewayProxyStructuredResultV2

beforeEach(() => {
  deletePhotoTag.mockReset()
  listPhotoTagsForGallery.mockReset().mockResolvedValue([])
  listAllPhotoTags.mockReset().mockResolvedValue([])
})

describe('DELETE /photo-tags/{imageId}/{personId}', () => {
  test('removes a tag', async () => {
    const res = await run(
      del,
      event({ pathParameters: { imageId: '500', personId: '23' } }),
    )
    expect(res.statusCode).toBe(200)
    expect(deletePhotoTag).toHaveBeenCalledWith(500, 23)
  })

  test('refuses a non-admin', async () => {
    deletePhotoTag.mockRejectedValue(new Error('must not be called'))
    const res = await run(
      del,
      event({ pathParameters: { imageId: '500', personId: '23' }, groups: 'approved' }),
    )
    expect(res.statusCode).toBe(403)
    expect(deletePhotoTag).not.toHaveBeenCalled()
  })

  test.each([
    ['abc', '23'],
    ['500', '-1'],
    ['', '23'],
  ])('rejects path params %s/%s', async (imageId, personId) => {
    const res = await run(del, event({ pathParameters: { imageId, personId } }))
    expect(res.statusCode).toBe(400)
    expect(deletePhotoTag).not.toHaveBeenCalled()
  })

  // Deliberately not a 404: "this person is not in this photograph" is
  // satisfied either way, and erroring on a double-tap is noise about a
  // non-problem.
  test('succeeds when the tag was not there', async () => {
    const res = await run(del, event({ pathParameters: { imageId: '1', personId: '2' } }))
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /photo-tags', () => {
  test('returns a gallery of tags', async () => {
    listPhotoTagsForGallery.mockResolvedValue([
      { image_id: 500, person_id: 23, gallery_id: 12 },
    ] as never)
    const res = await run(list, event({ queryStringParameters: { gallery_id: '12' } }))
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body as string).tags).toHaveLength(1)
    expect(listPhotoTagsForGallery).toHaveBeenCalledWith(12)
  })

  test('refuses a non-admin', async () => {
    listPhotoTagsForGallery.mockRejectedValue(new Error('must not be called'))
    const res = await run(
      list,
      event({ queryStringParameters: { gallery_id: '12' }, groups: 'approved' }),
    )
    expect(res.statusCode).toBe(403)
    expect(listPhotoTagsForGallery).not.toHaveBeenCalled()
  })

  // No gallery_id means every gallery -- what the picker asks for to
  // show progress across the archive.
  test('returns every tag when no gallery is named', async () => {
    listAllPhotoTags.mockResolvedValue([
      { image_id: 1, person_id: 2, gallery_id: 3 },
    ] as never)
    const res = await run(list, event({}))
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body as string).tags).toHaveLength(1)
    expect(listPhotoTagsForGallery).not.toHaveBeenCalled()
  })

  // A malformed value is still a 400. Quietly returning the whole
  // archive because someone typed gallery_id=abc would be a surprising
  // amount of data and a confusing answer to a question asked wrongly.
  // The bug this file did not catch. /^\d+$/ cannot match -1, so the two
  // synthetic groups -- the 263 photographs that belong to no gallery --
  // could be tagged but never read back: opening the group returned 400
  // and the page showed a load error. The old test only ever tried
  // 'abc', which a correct guard and a broken one both reject.
  test.each([
    ['-1', 'header images'],
    ['-2', 'miscellaneous'],
  ])('accepts gallery_id=%s, the %s group', async (raw) => {
    const res = await run(list, event({ queryStringParameters: { gallery_id: raw } }))
    expect(res.statusCode).toBe(200)
  })

  test('rejects a malformed gallery_id rather than returning everything', async () => {
    const res = await run(list, event({ queryStringParameters: { gallery_id: 'abc' } }))
    expect(res.statusCode).toBe(400)
    expect(listAllPhotoTags).not.toHaveBeenCalled()
    expect(listPhotoTagsForGallery).not.toHaveBeenCalled()
  })
})
