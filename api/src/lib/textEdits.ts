import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'
import { requireEnv } from './env'

// Proposed changes to a text's catalogue fields -- its byline, author
// record, genre, summary, and the people it is linked to.
//
// The same arrangement as photo tags (see photoTags.ts), for the same
// reason: the archive's writable copy lives on the archivist's machine
// and this API only reads a snapshot of it. An edit is collected here,
// and applied to Documents and DocumentLinks later by
// app/scripts/reviewTextEdits.ts. Nothing here can alter the archive.

// document_id is the partition key and field the sort key, so a text has
// at most one pending edit per field: changing the genre twice overwrites
// the first proposal rather than queueing two that disagree.
//
// field is one of 'author', 'author_person_id', 'genre', 'summary', or
// 'person#<id>' for a link -- where value true links that person to the
// text and false unlinks them.
export interface TextEdit {
  document_id: number
  field: string
  value: string | number | boolean | null
  // What the archive held when the edit was made. The apply script
  // compares it with what the archive holds now, and stops rather than
  // overwrite a change made in the meantime -- by the archivist editing
  // the database directly, say, between the snapshot and the apply.
  was: string | number | boolean | null
  edited_by: string
  edited_at: string
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

function tableName(): string {
  return requireEnv('TEXT_EDITS_TABLE')
}

export async function putTextEdit(edit: TextEdit): Promise<void> {
  await client.send(new PutCommand({ TableName: tableName(), Item: edit }))
}

export async function deleteTextEdit(documentId: number, field: string): Promise<void> {
  await client.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { document_id: documentId, field },
    }),
  )
}

export async function listTextEditsForDocument(documentId: number): Promise<TextEdit[]> {
  const edits: TextEdit[] = []
  let startKey: Record<string, unknown> | undefined

  do {
    const page = await client.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'document_id = :d',
        ExpressionAttributeValues: { ':d': documentId },
        ExclusiveStartKey: startKey,
      }),
    )
    edits.push(...((page.Items ?? []) as TextEdit[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)

  return edits
}

// Every pending edit. A Scan, for the same reason listAllPhotoTags is one:
// the question is "everything collected so far", and the table holds a
// few rows per text for a couple of hundred texts.
export async function listAllTextEdits(): Promise<TextEdit[]> {
  const edits: TextEdit[] = []
  let startKey: Record<string, unknown> | undefined

  do {
    const page = await client.send(
      new ScanCommand({ TableName: tableName(), ExclusiveStartKey: startKey }),
    )
    edits.push(...((page.Items ?? []) as TextEdit[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)

  return edits
}
