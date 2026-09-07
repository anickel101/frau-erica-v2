import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createWriteStream, readFileSync, rmSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import initSqlJs, { type Database } from 'sql.js'
import { requireEnv } from './env'
import { log } from './log'
import { SQL_WASM_BASE64 } from './sqlWasmBase64'

const LOCAL_DB_PATH = '/tmp/frau_erica.db'

const s3 = new S3Client({})

// Cached at module scope so a warm Lambda invocation reuses the snapshot
// already on /tmp instead of re-downloading from S3 on every request --
// only a cold start pays the download cost. Reset to null on failure (see
// getDbPath) so a transient S3 error doesn't get replayed forever on an
// otherwise-healthy warm container.
let snapshotPath: Promise<string> | null = null

export function getDbPath(): Promise<string> {
  if (!snapshotPath) {
    snapshotPath = downloadSnapshot().catch((err: unknown) => {
      snapshotPath = null
      log.error('db.snapshot-download-failed', err, {
        bucket: process.env.DB_BUCKET,
        key: process.env.DB_KEY,
      })
      throw err
    })
  }
  return snapshotPath
}

async function downloadSnapshot(): Promise<string> {
  const bucket = requireEnv('DB_BUCKET')
  const key = requireEnv('DB_KEY')

  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!response.Body) {
    throw new Error(`Empty response body fetching s3://${bucket}/${key}`)
  }

  await pipeline(response.Body as Readable, createWriteStream(LOCAL_DB_PATH))
  log.info('db.snapshot-downloaded', { bucket, key })
  return LOCAL_DB_PATH
}

// Also cached at module scope -- opening the snapshot bytes into a sql.js
// Database is cheap relative to the S3 download, but there's no reason to
// redo it on every warm invocation either. Same failure-reset as
// snapshotPath above.
let db: Promise<Database> | null = null

export function getDb(): Promise<Database> {
  if (!db) {
    db = openDb().catch((err: unknown) => {
      db = null
      // snapshotPath is cleared too, not just db.
      //
      // These are two separate caches, and only the download failure
      // path used to clear the download cache. So a snapshot that
      // downloaded *successfully* but was corrupt (a truncated upload,
      // a half-written backup) failed here in openDb, cleared db, and
      // left snapshotPath resolved to the bad /tmp file. Every
      // subsequent request on that warm container then re-read the same
      // corrupt bytes and failed identically -- including after the
      // problem was fixed in S3, since nothing would ever re-download.
      // A container can live for hours, so this outlasted the outage
      // that caused it.
      //
      // Deleting the file as well means the next attempt genuinely
      // starts over rather than trusting whatever is on disk.
      snapshotPath = null
      try {
        rmSync(LOCAL_DB_PATH, { force: true })
      } catch {
        // Best-effort. If the file can't be removed the redownload
        // overwrites it anyway; failing to clean up must not replace
        // the real error below.
      }
      log.error('db.snapshot-open-failed', err, { path: LOCAL_DB_PATH })
      throw err
    })
  }
  return db
}

async function openDb(): Promise<Database> {
  const path = await getDbPath()
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
  return new SQL.Database(readFileSync(path))
}
