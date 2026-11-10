import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { EditableText } from '../lib/queries/textEditTargets'

const putTextEdit = vi.fn()
const deleteTextEdit = vi.fn()
const listTextEditsForDocument = vi.fn(async () => [])
const listAllTextEdits = vi.fn(async () => [])
vi.mock('../lib/textEdits', () => ({
  putTextEdit,
  deleteTextEdit,
  listTextEditsForDocument,
  listAllTextEdits,
}))

// The snapshot, stubbed: these tests are about the handlers' guards. The
// queries run against real SQL in queries/textEditTargets.test.ts, and
// the save rules are tested on their own in textEditPlan.test.ts.
const getDb = vi.fn(async () => ({}))
vi.mock('../lib/db', () => ({ getDb }))

const text: EditableText = {
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
}
const getEditableText = vi.fn((): EditableText | null => text)
const listEditableTexts = vi.fn(() => [text])
vi.mock('../lib/queries/textEditTargets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/queries/textEditTargets')>()),
  getEditableText,
  listEditableTexts,
}))
const personExists = vi.fn(() => true)
vi.mock('../lib/queries/photoTagTargets', () => ({ personExists }))

const { handler: save } = await import('./saveTextEdits')
const { handler: list } = await import('./listTextEdits')

function event(
  parts: Partial<{ documentId: string; body: unknown; groups: string }>,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    pathParameters: parts.documentId ? { documentId: parts.documentId } : undefined,
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

const run = async (h: typeof save, e: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  (await h(e)) as APIGatewayProxyStructuredResultV2

beforeEach(() => {
  putTextEdit.mockReset()
  deleteTextEdit.mockReset()
  listTextEditsForDocument.mockReset().mockResolvedValue([])
  listAllTextEdits.mockReset().mockResolvedValue([])
  getDb.mockReset().mockResolvedValue({})
  getEditableText.mockReset().mockReturnValue(text)
  personExists.mockReset().mockImplementation(() => true)
})

describe('POST /text-edits/{documentId}', () => {
  test('stores a proposed change, signed by the admin who made it', async () => {
    const res = await run(save, event({ documentId: '40', body: { genre: 'Memoir' } }))
    expect(res.statusCode).toBe(200)
    expect(putTextEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 40,
        field: 'genre',
        value: 'Memoir',
        was: 'Other',
        edited_by: 'admin@example.com',
      }),
    )
  })

  test('clears an edit when the archive value is sent back', async () => {
    await run(save, event({ documentId: '40', body: { genre: 'Other' } }))
    expect(deleteTextEdit).toHaveBeenCalledWith(40, 'genre')
    expect(putTextEdit).not.toHaveBeenCalled()
  })

  // The guard has to run before the snapshot is read or anything is
  // written -- not merely produce a 403 eventually.
  test('refuses a non-admin before touching anything', async () => {
    getDb.mockRejectedValue(new Error('must not be called'))
    putTextEdit.mockRejectedValue(new Error('must not be called'))
    const res = await run(
      save,
      event({ documentId: '40', body: { genre: 'Memoir' }, groups: 'approved' }),
    )
    expect(res.statusCode).toBe(403)
    expect(getDb).not.toHaveBeenCalled()
    expect(putTextEdit).not.toHaveBeenCalled()
  })

  test.each(['abc', '0', '-3', ''])('rejects documentId %j', async (documentId) => {
    const res = await run(save, event({ documentId, body: { genre: 'Memoir' } }))
    expect(res.statusCode).toBe(400)
  })

  test('404s a text the page should not be editing', async () => {
    getEditableText.mockReturnValue(null)
    const res = await run(save, event({ documentId: '2', body: { genre: 'Memoir' } }))
    expect(res.statusCode).toBe(404)
    expect(putTextEdit).not.toHaveBeenCalled()
  })

  test('400s an invalid edit and writes nothing', async () => {
    const res = await run(save, event({ documentId: '40', body: { genre: 'Poetry' } }))
    expect(res.statusCode).toBe(400)
    expect(putTextEdit).not.toHaveBeenCalled()
    expect(deleteTextEdit).not.toHaveBeenCalled()
  })

  // All or nothing: one unknown person refuses the whole save, rather
  // than storing the rest and leaving the editor unsure which parts took.
  test('refuses the whole save if any person does not exist', async () => {
    personExists.mockImplementation(((_db: unknown, id: number) => id !== 999) as never)
    const res = await run(
      save,
      event({
        documentId: '40',
        body: { genre: 'Memoir', people: { 21: true, 999: true } },
      }),
    )
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body as string).error).toMatch(/999/)
    expect(putTextEdit).not.toHaveBeenCalled()
  })
})

describe('GET /text-edits', () => {
  test('returns the texts and every pending edit', async () => {
    listAllTextEdits.mockResolvedValue([{ document_id: 40, field: 'genre' }] as never)
    const res = await run(list, event({}))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body as string)
    expect(body.texts).toHaveLength(1)
    expect(body.edits).toHaveLength(1)
  })

  test('refuses a non-admin before touching anything', async () => {
    getDb.mockRejectedValue(new Error('must not be called'))
    listAllTextEdits.mockRejectedValue(new Error('must not be called'))
    const res = await run(list, event({ groups: 'approved' }))
    expect(res.statusCode).toBe(403)
    expect(getDb).not.toHaveBeenCalled()
    expect(listAllTextEdits).not.toHaveBeenCalled()
  })
})
