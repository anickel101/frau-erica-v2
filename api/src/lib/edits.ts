import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'
import { requireEnv } from './env'

// Staged edits: proposed changes to the archive, made on the site by an
// admin and applied later by app/scripts/reviewEdits.ts. One queue for
// every kind of record -- a text's byline or body, a photograph's
// caption, a gallery's summary -- so there is one review script and one
// set of rules for conflicts, rather than a table and a script per page.
//
// Nothing here can alter the archive. Its writable copy lives on the
// archivist's machine and this API only reads a snapshot of it; see
// api/CLAUDE.md's "Staged edits".
//
// Keyed by entity + field, so a record has at most one pending edit per
// field: changing a genre twice replaces the first proposal rather than
// queueing two that disagree. The entity names the record as
// "<type>#<id>" -- "document#12", later "image#246" -- which is what lets
// one table hold every kind.

export const EDIT_STATUSES = ['draft', 'submitted'] as const
export type EditStatus = (typeof EDIT_STATUSES)[number]

export type EditValue = string | number | boolean | null

export interface Edit {
  entity: string
  // A column ('author', 'summary', ...) or a link, 'person#<id>', whose
  // value true links that person and false unlinks them.
  field: string
  value: EditValue
  // What the archive held when the edit was made. The review script
  // compares it with what the archive holds now and holds the edit back
  // rather than overwrite a change made in the meantime.
  was: EditValue
  // A draft is work in progress, shared between admins and never
  // applied; only a submitted edit is ready for the review script.
  status: EditStatus
  edited_by: string
  edited_at: string
}

export function entityKey(type: string, id: number): string {
  return `${type}#${id}`
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

function tableName(): string {
  return requireEnv('EDITS_TABLE')
}

export async function putEdit(edit: Edit): Promise<void> {
  await client.send(new PutCommand({ TableName: tableName(), Item: edit }))
}

export async function deleteEdit(entity: string, field: string): Promise<void> {
  await client.send(new DeleteCommand({ TableName: tableName(), Key: { entity, field } }))
}

export async function listEditsForEntity(entity: string): Promise<Edit[]> {
  const edits: Edit[] = []
  let startKey: Record<string, unknown> | undefined
  do {
    const page = await client.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'entity = :e',
        ExpressionAttributeValues: { ':e': entity },
        ExclusiveStartKey: startKey,
      }),
    )
    edits.push(...((page.Items ?? []) as Edit[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return edits
}

// Every pending edit of one type. A Scan, filtered: the table holds a few
// rows per record for a few hundred records, so one cheap read of the
// whole thing beats an index nothing else would use.
export async function listEditsOfType(type: string): Promise<Edit[]> {
  const edits: Edit[] = []
  let startKey: Record<string, unknown> | undefined
  do {
    const page = await client.send(
      new ScanCommand({
        TableName: tableName(),
        FilterExpression: 'begins_with(entity, :t)',
        ExpressionAttributeValues: { ':t': `${type}#` },
        ExclusiveStartKey: startKey,
      }),
    )
    edits.push(...((page.Items ?? []) as Edit[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return edits
}
