import { Readable } from 'node:stream'
import { readFileSync, rmSync } from 'node:fs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createTestDb, seedFixtures } from './testFixtures'

const sendMock = vi.fn()
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
}))

beforeEach(() => {
  process.env.DB_BUCKET = 'frau-erica-db-backups'
  process.env.DB_KEY = 'current/frau_erica.db'
  sendMock.mockReset()
})

afterEach(() => {
  rmSync('/tmp/frau_erica.db', { force: true })
  vi.resetModules()
})

test('downloads the snapshot to /tmp and caches the promise across calls', async () => {
  sendMock.mockResolvedValue({ Body: Readable.from(['fake sqlite bytes']) })

  const { getDbPath } = await import('./db')
  const first = await getDbPath()
  const second = await getDbPath()

  expect(first).toBe('/tmp/frau_erica.db')
  expect(second).toBe(first)
  expect(sendMock).toHaveBeenCalledTimes(1)
  expect(readFileSync('/tmp/frau_erica.db', 'utf8')).toBe('fake sqlite bytes')
})

test('getDb opens a real snapshot using the embedded wasm binary and can query it', async () => {
  // Builds a real sqlite file (same way testFixtures does for the query
  // tests) and serves its bytes as the "S3 download" -- this is the one
  // test that actually exercises SQL_WASM_BASE64 end to end, proving the
  // embedded wasm asset genuinely opens a database rather than just
  // existing as an unused string constant.
  const fixtureDb = await createTestDb()
  await seedFixtures(fixtureDb)
  const bytes = fixtureDb.export()
  fixtureDb.close()

  sendMock.mockResolvedValue({ Body: Readable.from([Buffer.from(bytes)]) })

  const { getDb } = await import('./db')
  const db = await getDb()
  const result = db.exec('SELECT first_name, last_name FROM Persons WHERE person_id = 3')

  expect(result[0].values).toEqual([['Anna', 'Mueller']])
})

test('throws when DB_BUCKET or DB_KEY is missing', async () => {
  delete process.env.DB_BUCKET

  const { getDbPath } = await import('./db')
  await expect(getDbPath()).rejects.toThrow('DB_BUCKET environment variable is required')
})
