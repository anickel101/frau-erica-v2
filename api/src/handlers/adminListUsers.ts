import {
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { requireAdminAccess } from '../lib/auth'
import { getDb } from '../lib/db'
import { requireEnv } from '../lib/env'
import { GROUPS } from '../lib/groups'
import { jsonResponse } from '../lib/response'
import { inClause, queryAll } from '../lib/sqlHelpers'

const cognito = new CognitoIdentityProviderClient({})

// Pending users now show up here too (as of the pending-requests-list
// feature) -- accounts are created at Request Access time, in 'pending',
// with no person_id yet (see requestAccess.ts/adminApproveUser.ts).
const LISTED_GROUPS = [GROUPS.PENDING, GROUPS.APPROVED, GROUPS.ADMIN]

interface AdminUserSummary {
  email: string
  groups: string[]
  personId: number | null
  // Resolved from the linked person_id below, once one exists -- null
  // for pending accounts (no person_id yet) or the rare case of a
  // person_id that doesn't resolve to a real Persons row.
  fullName: string | null
  // Only ever set for accounts created via Request Access -- null for
  // anyone bootstrapped directly by an admin.
  requesterName: string | null
  connection: string | null
}

async function listGroup(userPoolId: string, groupName: string): Promise<UserType[]> {
  const users: UserType[] = []
  let nextToken: string | undefined

  do {
    const response = await cognito.send(
      new ListUsersInGroupCommand({
        UserPoolId: userPoolId,
        GroupName: groupName,
        NextToken: nextToken,
      }),
    )
    users.push(...(response.Users ?? []))
    nextToken = response.NextToken
  } while (nextToken)

  return users
}

// One batched query against the same read-only snapshot the gated
// content routes already use, rather than a GET /persons/:id per row --
// this is the same "don't multiply Lambda/DB round trips per person"
// lesson from the Family page performance pass.
async function resolveFullNames(personIds: number[]): Promise<Map<number, string>> {
  if (personIds.length === 0) return new Map()
  const db = await getDb()
  const ids = inClause('id', personIds)
  const rows = queryAll<{ person_id: number; first_name: string; last_name: string }>(
    db,
    `SELECT person_id, first_name, last_name FROM Persons WHERE person_id IN (${ids.sql})`,
    ids.params,
  )
  return new Map(rows.map((row) => [row.person_id, `${row.first_name} ${row.last_name}`]))
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const userPoolId = requireEnv('COGNITO_USER_POOL_ID')

  const byEmail = new Map<string, AdminUserSummary>()

  for (const groupName of LISTED_GROUPS) {
    const users = await listGroup(userPoolId, groupName)
    for (const user of users) {
      const email = user.Attributes?.find((a) => a.Name === 'email')?.Value
      if (!email) continue

      const personIdAttr = user.Attributes?.find(
        (a) => a.Name === 'custom:person_id',
      )?.Value
      const personId = personIdAttr ? Number(personIdAttr) : null
      const requesterName =
        user.Attributes?.find((a) => a.Name === 'custom:requester_name')?.Value ?? null
      const connection =
        user.Attributes?.find((a) => a.Name === 'custom:connection')?.Value ?? null

      const existing = byEmail.get(email)
      if (existing) {
        existing.groups.push(groupName)
      } else {
        byEmail.set(email, {
          email,
          groups: [groupName],
          personId,
          fullName: null,
          requesterName,
          connection,
        })
      }
    }
  }

  const personIds = Array.from(byEmail.values())
    .map((user) => user.personId)
    .filter((id): id is number => id !== null)
  const namesByPersonId = await resolveFullNames(personIds)
  for (const user of byEmail.values()) {
    if (user.personId !== null) {
      user.fullName = namesByPersonId.get(user.personId) ?? null
    }
  }

  return jsonResponse(200, { users: Array.from(byEmail.values()) })
}
