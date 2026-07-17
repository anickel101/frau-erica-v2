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
import { requireEnv } from '../lib/env'
import { GROUPS } from '../lib/groups'
import { jsonResponse } from '../lib/response'

const cognito = new CognitoIdentityProviderClient({})

// Skip 'pending' -- under this project's design (see the admin-approval
// plan), nobody is ever actually placed in that group; accounts only
// come into existence already 'approved'.
const LISTED_GROUPS = [GROUPS.APPROVED, GROUPS.ADMIN]

interface AdminUserSummary {
  email: string
  groups: string[]
  personId: number | null
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

      const existing = byEmail.get(email)
      if (existing) {
        existing.groups.push(groupName)
      } else {
        byEmail.set(email, { email, groups: [groupName], personId })
      }
    }
  }

  return jsonResponse(200, { users: Array.from(byEmail.values()) })
}
