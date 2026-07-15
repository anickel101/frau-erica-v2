import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createWriteStream, readFileSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import initSqlJs, { type Database } from 'sql.js'
import { SQL_WASM_BASE64 } from './sqlWasmBase64'

const LOCAL_DB_PATH = '/tmp/frau_erica.db'

const s3 = new S3Client({})

// Cached at module scope so a warm Lambda invocation reuses the snapshot
// already on /tmp instead of re-downloading from S3 on every request --
// only a cold start pays the download cost.
let snapshotPath: Promise<string> | null = null

export function getDbPath(): Promise<string> {
  if (!snapshotPath) {
    snapshotPath = downloadSnapshot()
  }
  return snapshotPath
}

async function downloadSnapshot(): Promise<string> {
  const bucket = process.env.DB_BUCKET
  const key = process.env.DB_KEY
  if (!bucket || !key) {
    throw new Error('DB_BUCKET and DB_KEY environment variables are required')
  }

  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!response.Body) {
    throw new Error(`Empty response body fetching s3://${bucket}/${key}`)
  }

  await pipeline(response.Body as Readable, createWriteStream(LOCAL_DB_PATH))
  return LOCAL_DB_PATH
}

// Also cached at module scope -- opening the snapshot bytes into a sql.js
// Database is cheap relative to the S3 download, but there's no reason to
// redo it on every warm invocation either.
let db: Promise<Database> | null = null

export function getDb(): Promise<Database> {
  if (!db) {
    db = openDb()
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
