import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'
import { requireEnv } from './env'

// Who appears in a photograph.
//
// This lives in its own DynamoDB table, NOT in the archive's ImageLinks
// table, and that separation is the whole design rather than an
// implementation detail.
//
// The archive is a SQLite file whose writable copy lives on the
// archivist's own machine; the API only ever reads a snapshot of it from
// S3. Letting a web form write into that would mean inverting which copy
// is authoritative, retiring the nightly backup job, and taking on
// concurrent-write handling -- a large, risky piece of work that was
// deliberately deferred (see the "dad-database-interface-plan" writeup).
//
// Tagging doesn't need any of it. A tag is append-only, low-stakes, and
// easily discarded if wrong, so the tags are collected here and applied
// to ImageLinks later in a reviewed batch -- the same propose-then-apply
// shape the parallel-text splitter and the date proposer already use.
// The archive stays exactly as it is, and nothing the tagging tool does
// can alter it.

// image_id is the partition key and person_id the sort key, which makes
// (image, person) unique for free: tagging the same person twice is an
// idempotent overwrite rather than a duplicate row. There is no "tag id"
// to collide over and no de-duplication to write.
export interface PhotoTag {
  image_id: number
  person_id: number
  // Carried so a whole gallery's tags can be fetched in one query (see
  // the by-gallery index) rather than one request per photograph.
  gallery_id: number
  // Provenance, because these rows become archive data later and
  // "who said so, and when" is the first question anyone will ask of a
  // tag that looks wrong.
  tagged_by: string
  tagged_at: string
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

export const BY_GALLERY_INDEX = 'by-gallery'

function tableName(): string {
  return requireEnv('PHOTO_TAGS_TABLE')
}

export async function putPhotoTag(tag: PhotoTag): Promise<void> {
  await client.send(new PutCommand({ TableName: tableName(), Item: tag }))
}

export async function deletePhotoTag(imageId: number, personId: number): Promise<void> {
  await client.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { image_id: imageId, person_id: personId },
    }),
  )
}

// Every tag in one gallery, which is what the tagging page asks for when
// it opens: it needs to show what is already done, and resume where the
// archivist stopped.
//
// Paginated explicitly rather than trusting a single response. A gallery
// of sixteen photographs will never approach DynamoDB's 1MB page limit,
// but a silently truncated list here would show a photograph as untagged
// when it isn't, and invite a duplicate pass over work already finished.
export async function listPhotoTagsForGallery(galleryId: number): Promise<PhotoTag[]> {
  const tags: PhotoTag[] = []
  let startKey: Record<string, unknown> | undefined

  do {
    const page = await client.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: BY_GALLERY_INDEX,
        KeyConditionExpression: 'gallery_id = :g',
        ExpressionAttributeValues: { ':g': galleryId },
        ExclusiveStartKey: startKey,
      }),
    )
    tags.push(...((page.Items ?? []) as PhotoTag[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)

  return tags
}

// Every tag, across every gallery.
//
// A Scan, which is usually the wrong instinct in DynamoDB -- but the
// question really is "everything collected so far", and the table holds
// one row per person per photograph for an archive of a few hundred
// photographs. Querying each gallery's index separately would be 31
// requests to answer a question one request answers.
//
// What it is for: the gallery picker shows how far along each gallery
// is, and how much work is collected but not yet in the archive. Without
// it the only way to know either was to run a script on the archivist's
// own machine.
export async function listAllPhotoTags(): Promise<PhotoTag[]> {
  const tags: PhotoTag[] = []
  let startKey: Record<string, unknown> | undefined

  do {
    const page = await client.send(
      new ScanCommand({ TableName: tableName(), ExclusiveStartKey: startKey }),
    )
    tags.push(...((page.Items ?? []) as PhotoTag[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)

  return tags
}
