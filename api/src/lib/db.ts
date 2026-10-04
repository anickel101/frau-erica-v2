import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createWriteStream, readFileSync, rmSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import initSqlJs, { type Database } from 'sql.js'
import { requireEnv } from './env'
import { log } from './log'
import { SQL_WASM_BASE64 } from './sqlWasmBase64'

const LOCAL_DB_PATH = '/tmp/frau_erica.db'

const s3 = new S3Client({})

// The snapshot, and the ETag of the S3 object it came from.
//
// Cached at module scope so a warm invocation reuses what is already on
// /tmp instead of re-downloading on every request -- only a cold start
// pays the download. The ETag is what makes that cache safe.
//
// WHY THE ETAG IS HERE AT ALL. The cache used to have no expiry of any
// kind: a container that started before an edit kept serving the old
// snapshot for as long as it lived, which can be hours. That is not a
// hypothetical. On 2026-10-04 a header image and a preferred name were
// changed, the snapshot was pushed to S3 four minutes later, and the
// live site went on showing the old values with zero re-downloads
// recorded -- while OTHER containers, started after the push, served the
// new ones. So the site disagreed with itself depending on which
// container answered, with no error anywhere and no way to tell how long
// it would last.
//
// Checking is cheap enough to do on every request: a HeadObject is a few
// milliseconds against a ~2s cold start, and S3 charges for it in
// fractions of a cent per thousand. It needs no IAM change either --
// HEAD on an object is authorised by s3:GetObject, which every
// DB-reading function already has.
let cached: { etag: string; db: Database } | null = null

// In flight, so several concurrent requests on one container cannot each
// start their own download of the same snapshot.
let loading: Promise<Database> | null = null

async function currentEtag(): Promise<string | null> {
  const bucket = requireEnv('DB_BUCKET')
  const key = requireEnv('DB_KEY')
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return head.ETag ?? null
  } catch (err) {
    // Deliberately not fatal, and deliberately not a reload either.
    //
    // If S3 can't be reached, a cached snapshot is still a perfectly good
    // answer -- serving slightly stale family data beats failing the
    // request outright. The only cost of guessing wrong here is that an
    // edit takes longer to appear, which is exactly the situation that
    // existed before this check.
    log.warn('db.freshness-check-failed', {
      bucket,
      key,
      reason: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export async function getDb(): Promise<Database> {
  const etag = await currentEtag()

  // A null ETag means the check failed, not that the object changed --
  // keep whatever is cached rather than re-downloading on every request
  // for as long as S3 is unreachable.
  if (cached && (etag === null || etag === cached.etag)) {
    return cached.db
  }

  if (!loading) {
    loading = load(etag).finally(() => {
      loading = null
    })
  }
  return loading
}

async function load(etag: string | null): Promise<Database> {
  const previous = cached
  try {
    const bytes = await downloadSnapshot()
    const db = await openDb(bytes)

    // Close the database being replaced, so a long-lived container
    // refreshing many times doesn't accumulate WASM heaps.
    if (previous) {
      try {
        previous.db.close()
      } catch {
        // Best effort -- a database that won't close must not stop the
        // new one being installed.
      }
    }

    // The ETag read BEFORE the download is the one recorded. If the
    // object changed again mid-download, that tag won't match what is
    // now in S3, so the next request re-downloads. Recording the newer
    // tag would be the dangerous way round: it would mark bytes as
    // current that were already superseded.
    cached = { etag: etag ?? '', db }
    log.info('db.snapshot-loaded', { etag })
    return db
  } catch (err) {
    // Both the file and the cache are cleared, not just one.
    //
    // An earlier version cleared only the parsed-database cache on a
    // failure, leaving the downloaded path pointing at the bad /tmp
    // file, so every later request on that warm container replayed the
    // same failure -- including after the problem was fixed in S3, since
    // nothing would ever re-download. A container can live for hours, so
    // the outage outlasted its cause.
    //
    // Note sql.js does NOT reject arbitrary bytes at open time (checked:
    // it accepts the string 'not a database'), so a truncated snapshot
    // may well load and fail later at query time instead. This path
    // handles any load failure rather than corruption specifically.
    cached = null
    try {
      rmSync(LOCAL_DB_PATH, { force: true })
    } catch {
      // Best-effort. If the file can't be removed the next download
      // overwrites it anyway; failing to clean up must not replace the
      // real error below.
    }
    log.error('db.snapshot-load-failed', err, {
      bucket: process.env.DB_BUCKET,
      key: process.env.DB_KEY,
    })
    throw err
  }
}

async function downloadSnapshot(): Promise<Buffer> {
  const bucket = requireEnv('DB_BUCKET')
  const key = requireEnv('DB_KEY')

  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!response.Body) {
    throw new Error(`Empty response body fetching s3://${bucket}/${key}`)
  }

  // Still written to /tmp rather than held only in memory: the file is
  // what makes a failed parse debuggable, and Lambda gives /tmp away
  // free where memory is what the function is billed on.
  await pipeline(response.Body as Readable, createWriteStream(LOCAL_DB_PATH))
  log.info('db.snapshot-downloaded', { bucket, key })
  return readFileSync(LOCAL_DB_PATH)
}

async function openDb(bytes: Buffer): Promise<Database> {
  // wasmBinary is supplied directly from the embedded base64 asset
  // (see sqlWasmBase64.ts) so sql.js never tries to locate/read its own
  // .wasm file on disk -- that lookup is relative to sql.js's own
  // package directory, which isn't guaranteed to exist once bundled for
  // Lambda.
  const wasmBuffer = Buffer.from(SQL_WASM_BASE64, 'base64')
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength,
  ) as ArrayBuffer
  const SQL = await initSqlJs({ wasmBinary })
  return new SQL.Database(bytes)
}

// Kept for the tests that assert the download path and the missing-env
// behaviour directly. Handlers use getDb().
export async function getDbPath(): Promise<string> {
  await getDb()
  return LOCAL_DB_PATH
}
