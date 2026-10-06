import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { parsePersonIdUpdateBody, type PersonIdUpdateBody } from '../lib/adminUserBody'
import { getCallerEmail, requireAdminAccess } from '../lib/auth'
import { requireEnv } from '../lib/env'
import { GROUPS } from '../lib/groups'
import { log } from '../lib/log'
import { parseJsonBody } from '../lib/parseJsonBody'
import { jsonResponse } from '../lib/response'
import { withLogging } from '../lib/withLogging'

const cognito = new CognitoIdentityProviderClient({})

async function userExists(userPoolId: string, email: string): Promise<boolean> {
  try {
    await cognito.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }),
    )
    return true
  } catch (err) {
    if (err instanceof UserNotFoundException) return false
    throw err
  }
}

async function baseHandler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const denied = requireAdminAccess(event)
  if (denied) return denied

  const body = parseJsonBody<PersonIdUpdateBody>(event.body)
  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const parsed = parsePersonIdUpdateBody(body)
  if (!parsed) {
    return jsonResponse(400, { error: 'email and a numeric personId are both required' })
  }
  const { email, personId } = parsed

  const userPoolId = requireEnv('COGNITO_USER_POOL_ID')

  const hadPriorRequest = await userExists(userPoolId, email)

  if (hadPriorRequest) {
    // Came through Request Access -- already exists in 'pending', with
    // custom:requester_name/connection set (see requestAccess.ts) but no
    // person_id yet and no usable credentials (created with
    // MessageAction: 'SUPPRESS').
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [{ Name: 'custom:person_id', Value: String(personId) }],
      }),
    )
    // Logged here rather than only on full success. This write is
    // already durable, and the three calls after it can throw -- so
    // without this line a person_id could be changed and leave no trace
    // anywhere except a generic request.failed, while the admin sees a
    // 500 and reasonably concludes nothing happened.
    log.info('admin.person-id-set', {
      actor: getCallerEmail(event),
      target: email,
      personId,
    })
    // Resends the invitation -- the first time this person actually
    // receives real login credentials.
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        MessageAction: 'RESEND',
      }),
    )
  } else {
    // No prior request on record -- admin-initiated from scratch (e.g.
    // bootstrapping the site's own first admin account).
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:person_id', Value: String(personId) },
        ],
        // Default DesiredDeliveryMediums is SMS, not EMAIL -- must be
        // explicit or the invitation goes nowhere (no phone number was
        // ever set) with no error. MessageAction left unset so Cognito's
        // own invitation email actually fires.
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    )
  }

  // ADD to approved before REMOVING from pending, and never the other
  // way round.
  //
  // The removal used to run first. If the add then failed -- a throttle,
  // a transient 5xx -- the account belonged to NO group, and
  // adminListUsers enumerates membership group by group, so the person
  // being approved disappeared from the admin table altogether: not
  // pending, not approved, not deletable from the UI, recoverable only
  // from the AWS console or by retyping their exact address into this
  // form. They themselves got a 403 on every gated route.
  //
  // In this order a half-failure leaves them in BOTH groups, which
  // hasApprovedAccess already treats as approved and which the admin
  // list still shows. Retrying is safe: AdminAddUserToGroup on an
  // existing member is a no-op, and so is removing a non-member.
  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: email,
      GroupName: GROUPS.APPROVED,
    }),
  )

  if (hadPriorRequest) {
    await cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: GROUPS.PENDING,
      }),
    )
  }

  // The moment someone gains access to the gated family data. Records
  // which of the two paths ran, because they differ in a way that
  // matters when an approval is reported as not having worked:
  // hadPriorRequest resends an existing invitation, the other branch
  // creates the account and sends a first one.
  log.info('admin.user-approved', {
    actor: getCallerEmail(event),
    target: email,
    personId,
    hadPriorRequest,
  })
  return jsonResponse(200, { ok: true })
}

export const handler = withLogging('admin-approve-user', baseHandler)
