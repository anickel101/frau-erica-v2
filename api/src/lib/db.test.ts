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
    readonly kind = 'get'
    constructor(public input: unknown) {}
  },
  HeadObjectCommand: class {
    readonly kind = 'head'
    constructor(public input: unknown) {}
  },
}))

// Answers a HeadObject with the given ETag and a GetObject with the
// given bytes, so a test can change what S3 "contains" between calls.
function s3Serves(etag: string, bytes: string | Buffer) {
  sendMock.mockImplementation((command: { kind: string }) =>
    command.kind === 'head'
      ? Promise.resolve({ ETag: etag })
      : Promise.resolve({ Body: Readable.from([bytes]) }),
  )
}

const downloads = () =>
  sendMock.mock.calls.filter(([c]) => (c as { kind: string }).kind === 'get').length

beforeEach(() => {
  process.env.DB_BUCKET = 'frau-erica-db-backups'
  process.env.DB_KEY = 'current/frau_erica.db'
  sendMock.mockReset()
})

afterEach(() => {
  rmSync('/tmp/frau_erica.db', { force: true })
  vi.resetModules()
})

test('downloads the snapshot to /tmp and reuses it while the ETag is unchanged', async () => {
  s3Serves('"abc"', 'fake sqlite bytes')

  const { getDbPath } = await import('./db')
  const first = await getDbPath()
  const second = await getDbPath()

  expect(first).toBe('/tmp/frau_erica.db')
  expect(second).toBe(first)
  expect(downloads()).toBe(1)
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

  s3Serves('"v1"', Buffer.from(bytes))

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

// The bug this whole mechanism exists for. Confirmed against the live
// stack on 2026-10-04: an edit was pushed to S3, and containers started
// before the push went on serving the old snapshot with zero
// re-downloads, while newer containers served the new one -- so the site
// disagreed with itself depending on which answered.
test('re-downloads when the snapshot in S3 has changed', async () => {
  s3Serves('"v1"', 'first version')

  const { getDbPath } = await import('./db')
  await getDbPath()
  expect(readFileSync('/tmp/frau_erica.db', 'utf8')).toBe('first version')

  s3Serves('"v2"', 'second version')
  await getDbPath()

  expect(downloads()).toBe(2)
  expect(readFileSync('/tmp/frau_erica.db', 'utf8')).toBe('second version')
})

// Serving slightly stale family data beats failing the request. The only
// cost of guessing wrong is that an edit takes longer to appear, which
// is the situation that existed before this check.
test('keeps serving the cached snapshot when the freshness check fails', async () => {
  s3Serves('"v1"', 'cached version')

  const { getDbPath } = await import('./db')
  await getDbPath()

  sendMock.mockImplementation((command: { kind: string }) =>
    command.kind === 'head'
      ? Promise.reject(new Error('S3 unreachable'))
      : Promise.resolve({ Body: Readable.from(['should not be fetched']) }),
  )
  await getDbPath()

  expect(downloads()).toBe(1)
  expect(readFileSync('/tmp/frau_erica.db', 'utf8')).toBe('cached version')
})

// A container handling several requests around a cold start must not
// start a download per request.
test('concurrent callers share one download', async () => {
  s3Serves('"v1"', 'shared')

  const { getDb } = await import('./db')
  await Promise.all([getDb(), getDb(), getDb()])

  expect(downloads()).toBe(1)
})

// A failed load used to poison a warm container for its whole lifetime,
// because only one of the two caches was cleared. A container can live
// for hours, so the outage outlasted whatever caused it.
//
// The failure here is a download error rather than corrupt bytes: sql.js
// opens arbitrary content without complaining (checked -- it accepts the
// string 'not a database' quite happily), so a bad snapshot does not
// necessarily fail at open time. What matters is that ANY load failure
// leaves the container able to try again.
test('a failed load does not poison the container', async () => {
  sendMock.mockImplementation((command: { kind: string }) =>
    command.kind === 'head'
      ? Promise.resolve({ ETag: '"v1"' })
      : Promise.reject(new Error('S3 is having a bad day')),
  )

  const { getDb } = await import('./db')
  await expect(getDb()).rejects.toThrow('S3 is having a bad day')

  // S3 recovers. The next request must genuinely retry rather than
  // replay the failure from a cache that was never cleared.
  s3Serves('"v1"', 'recovered')
  await getDb()

  expect(readFileSync('/tmp/frau_erica.db', 'utf8')).toBe('recovered')
})
