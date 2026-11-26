import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

// Every function that touches the edits queue must be granted each
// DynamoDB action its handler's code actually performs.
//
// The handler tests mock DynamoDB, so they pass whatever the IAM policy
// says. That is how the editor shipped unable to open a text (2026-11-25):
// GET /edits?id= reads one record with a Query, and ListEditsFunction was
// granted only the Scan the list view needed -- a 500 in production, and
// green in CI. This reads the handler's imports from lib/edits.ts and the
// function's policy from template.yaml and checks the one covers the other.

const ACTION_FOR: Record<string, string> = {
  putEdit: 'dynamodb:PutItem',
  deleteEdit: 'dynamodb:DeleteItem',
  listEditsForEntity: 'dynamodb:Query',
  listEditsOfType: 'dynamodb:Scan',
}

const SRC = import.meta.dirname
const template = readFileSync(path.join(SRC, '..', 'template.yaml'), 'utf8')

// The resource block for one function: from its logical id to the next
// top-level resource (two-space indent).
function functionBlock(logicalId: string): string {
  const start = template.indexOf(`\n  ${logicalId}:\n`)
  if (start < 0) throw new Error(`${logicalId} not in template.yaml`)
  const rest = template.slice(start + 1)
  const next = rest.slice(1).search(/\n {2}[A-Za-z]/)
  return next < 0 ? rest : rest.slice(0, next + 1)
}

function editsCalls(handler: string): string[] {
  const source = readFileSync(path.join(SRC, 'handlers', `${handler}.ts`), 'utf8')
  const imported = source.match(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/lib\/edits'/)
  if (!imported) return []
  return imported[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name in ACTION_FOR)
}

describe.each([
  ['SaveEditsFunction', 'saveEdits'],
  ['ListEditsFunction', 'listEdits'],
])('%s', (logicalId, handler) => {
  test('is granted every queue action its handler performs', () => {
    const calls = editsCalls(handler)
    expect(calls.length).toBeGreaterThan(0) // the import really was found
    const block = functionBlock(logicalId)
    for (const call of calls) {
      expect(block, `${handler} calls ${call}`).toContain(ACTION_FOR[call])
    }
  })
})
