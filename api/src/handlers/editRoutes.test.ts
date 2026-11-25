import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { EditableTextDetail } from '../lib/queries/textEditTargets'

const putEdit = vi.fn()
const deleteEdit = vi.fn()
const listEditsForEntity = vi.fn(async () => [])
const listEditsOfType = vi.fn(async () => [])
vi.mock('../lib/edits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/edits')>()),
  putEdit,
  deleteEdit,
  listEditsForEntity,
  listEditsOfType,
}))

// The snapshot, stubbed: these tests are about the handlers' guards. The
// queries run against real SQL in queries/textEditTargets.test.ts, and
// the save rules are tested on their own in textEditPlan.test.ts.
const getDb = vi.fn(async () => ({}))
vi.mock('../lib/db', () => ({ getDb }))

const text: EditableTextDetail = {
  document_id: 40,
  title: 'Chicago 1972',
  series_key: null,
  series_title: null,
  series_order: null,
  author: null,
  author_person_id: null,
  genre: 'Other',
  summary: null,
  tags: null,
  person_ids: [],
  content: 'It was hot.',
  bilingual: false,
}
const getEditableTextDetail = vi.fn((): EditableTextDetail | null => text)
const listEditableTexts = vi.fn(() => [text])
vi.mock('../lib/queries/textEditTargets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/queries/textEditTargets')>()),
  getEditableTextDetail,
  listEditableTexts,
}))
const personExists = vi.fn(() => true)
vi.mock('../lib/queries/photoTagTargets', () => ({ personExists }))

const { handler: save } = await import('./saveEdits')
const { handler: list } = await import('./listEdits')

function event(
  parts: Partial<{
    type: string
    id: string
    query: Record<string, string>
    body: unknown
    groups: string
  }>,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    pathParameters:
      parts.type !== undefined || parts.id !== undefined
        ? { type: parts.type, id: parts.id }
        : undefined,
    queryStringParameters: parts.query,
    body: parts.body === undefined ? undefined : JSON.stringify(parts.body),
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

const saveDoc = (id: string, body: unknown, groups?: string) =>
  event({ type: 'document', id, body, groups })

const run = async (h: typeof save, e: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  (await h(e)) as APIGatewayProxyStructuredResultV2

beforeEach(() => {
  putEdit.mockReset()
  deleteEdit.mockReset()
  listEditsForEntity.mockReset().mockResolvedValue([])
  listEditsOfType.mockReset().mockResolvedValue([])
  getDb.mockReset().mockResolvedValue({})
  getEditableTextDetail.mockReset().mockReturnValue(text)
  personExists.mockReset().mockImplementation(() => true)
})

describe('POST /edits/{type}/{id}', () => {
  test('stores a proposed change, signed by the admin who made it', async () => {
    const res = await run(save, saveDoc('40', { changes: { genre: 'Memoir' } }))
    expect(res.statusCode).toBe(200)
    expect(putEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'document#40',
        field: 'genre',
        value: 'Memoir',
        was: 'Other',
        status: 'submitted',
        edited_by: 'admin@example.com',
      }),
    )
  })

  test('saves a draft when asked', async () => {
    await run(save, saveDoc('40', { changes: { genre: 'Memoir' }, status: 'draft' }))
    expect(putEdit).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }))
  })

  test('refuses a status that is neither draft nor submitted', async () => {
    const res = await run(
      save,
      saveDoc('40', { changes: { genre: 'Memoir' }, status: 'published' }),
    )
    expect(res.statusCode).toBe(400)
    expect(putEdit).not.toHaveBeenCalled()
  })

  test('clears an edit when the archive value is sent back', async () => {
    await run(save, saveDoc('40', { changes: { genre: 'Other' } }))
    expect(deleteEdit).toHaveBeenCalledWith('document#40', 'genre')
    expect(putEdit).not.toHaveBeenCalled()
  })

  // The guard has to run before the snapshot is read or anything is
  // written -- not merely produce a 403 eventually.
  test('refuses a non-admin before touching anything', async () => {
    getDb.mockRejectedValue(new Error('must not be called'))
    putEdit.mockRejectedValue(new Error('must not be called'))
    const res = await run(
      save,
      saveDoc('40', { changes: { genre: 'Memoir' } }, 'approved'),
    )
    expect(res.statusCode).toBe(403)
    expect(getDb).not.toHaveBeenCalled()
    expect(putEdit).not.toHaveBeenCalled()
  })

  test.each(['image', 'constructor', '__proto__', ''])(
    '404s record type %j',
    async (type) => {
      const res = await run(
        save,
        event({ type, id: '40', body: { changes: { genre: 'Memoir' } } }),
      )
      expect(res.statusCode).toBe(404)
      expect(getDb).not.toHaveBeenCalled()
    },
  )

  test.each(['abc', '0', '-3', ''])('rejects id %j', async (id) => {
    const res = await run(save, saveDoc(id, { changes: { genre: 'Memoir' } }))
    expect(res.statusCode).toBe(400)
  })

  test.each([null, [], 'genre'])('rejects body %j', async (body) => {
    const res = await run(save, saveDoc('40', body))
    expect(res.statusCode).toBe(400)
    expect(putEdit).not.toHaveBeenCalled()
  })

  test('404s a text the page should not be editing', async () => {
    getEditableTextDetail.mockReturnValue(null)
    const res = await run(save, saveDoc('2', { changes: { genre: 'Memoir' } }))
    expect(res.statusCode).toBe(404)
    expect(putEdit).not.toHaveBeenCalled()
  })

  test('400s an invalid edit and writes nothing', async () => {
    const res = await run(save, saveDoc('40', { changes: { genre: 'Poetry' } }))
    expect(res.statusCode).toBe(400)
    expect(putEdit).not.toHaveBeenCalled()
    expect(deleteEdit).not.toHaveBeenCalled()
  })

  // All or nothing: one unknown person refuses the whole save, rather
  // than storing the rest and leaving the editor unsure which parts took.
  test('refuses the whole save if any person does not exist', async () => {
    personExists.mockImplementation(((_db: unknown, id: number) => id !== 999) as never)
    const res = await run(
      save,
      saveDoc('40', { changes: { genre: 'Memoir', people: { 21: true, 999: true } } }),
    )
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body as string).error).toMatch(/999/)
    expect(putEdit).not.toHaveBeenCalled()
  })
})

describe('GET /edits?type=', () => {
  test('returns the records and every pending edit of that type', async () => {
    listEditsOfType.mockResolvedValue([
      { entity: 'document#40', field: 'genre' },
    ] as never)
    const res = await run(list, event({ query: { type: 'document' } }))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body as string)
    expect(body.targets).toHaveLength(1)
    expect(body.edits).toHaveLength(1)
    expect(listEditsOfType).toHaveBeenCalledWith('document')
  })

  test.each([undefined, 'image', 'toString'])('400s type %j', async (type) => {
    const res = await run(list, event({ query: type ? { type } : undefined }))
    expect(res.statusCode).toBe(400)
    expect(getDb).not.toHaveBeenCalled()
  })

  test('returns one text in full, with only its own edits', async () => {
    listEditsForEntity.mockResolvedValue([
      { entity: 'document#40', field: 'content' },
    ] as never)
    const res = await run(list, event({ query: { type: 'document', id: '40' } }))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body as string)
    expect(body.targets).toEqual([text])
    expect(listEditsForEntity).toHaveBeenCalledWith('document#40')
    expect(listEditsOfType).not.toHaveBeenCalled()
  })

  test('404s one text that cannot be edited', async () => {
    getEditableTextDetail.mockReturnValue(null)
    const res = await run(list, event({ query: { type: 'document', id: '2' } }))
    expect(res.statusCode).toBe(404)
  })

  test.each(['abc', '0', '-1', ''])('400s id %j', async (id) => {
    const res = await run(list, event({ query: { type: 'document', id } }))
    expect(res.statusCode).toBe(400)
  })

  test('refuses a non-admin before touching anything', async () => {
    getDb.mockRejectedValue(new Error('must not be called'))
    listEditsOfType.mockRejectedValue(new Error('must not be called'))
    const res = await run(
      list,
      event({ query: { type: 'document' }, groups: 'approved' }),
    )
    expect(res.statusCode).toBe(403)
    expect(getDb).not.toHaveBeenCalled()
    expect(listEditsOfType).not.toHaveBeenCalled()
  })
})
