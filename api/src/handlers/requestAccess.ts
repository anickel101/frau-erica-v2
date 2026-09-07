import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { requireEnv } from '../lib/env'
import { GROUPS } from '../lib/groups'
import { log } from '../lib/log'
import { parseJsonBody } from '../lib/parseJsonBody'
import { isVerificationAcceptable, verifyRecaptcha } from '../lib/recaptcha'
import { jsonResponse } from '../lib/response'
import { getRecaptchaSecret } from '../lib/secrets'
import { sendAdminNotification } from '../lib/ses'
import { withLogging } from '../lib/withLogging'

const cognito = new CognitoIdentityProviderClient({})

interface RequestBody {
  name?: string
  email?: string
  connection?: string
  recaptchaToken?: string
}

// Cognito enforces its own email format and caps custom attributes at
// 2048 characters. Hitting either of those limits used to surface as an
// InvalidParameterException from AdminCreateUser -- which isn't
// UsernameExistsException, so it propagated as a 500 *before*
// sendAdminNotification ran. The requester saw an error and the
// archivist never learned they'd asked. Validating here turns both cases
// into an actionable 400 the requester can fix themselves, well before
// anything irreversible happens.
const MAX_NAME_LENGTH = 200
const MAX_CONNECTION_LENGTH = 1500
// Deliberately permissive -- Cognito is the real authority on what it
// will accept, and over-strict client-side email regexes reject valid
// addresses. This only catches the obviously-malformed (no @, spaces,
// no dot in the domain), which is what a typo actually looks like.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Below Google's documented 0.5 default, deliberately. reCAPTCHA is not
// the security boundary on this route -- every request lands in 'pending'
// with no usable credentials and a human reviews it before any access is
// granted. So the two kinds of mistake are wildly asymmetric: a false
// positive is one junk row the archivist ignores, while a false negative
// turns a real relative away with an error implying they did something
// wrong. Two actual family members hit exactly that on launch day.
// Scores are logged below, so this can be tuned against real data rather
// than guessed at again.
const RECAPTCHA_SCORE_THRESHOLD = 0.3

// No authorizer on this route (see template.yaml's Auth: Authorizer: NONE
// override) -- the requester has no account yet, so this is a plain
// APIGatewayProxyEventV2, not the JWT-authorizer variant every other
// handler in this project uses.
async function baseHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const body = parseJsonBody<RequestBody>(event.body)
  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const { name, email, connection, recaptchaToken } = body

  // Every rejection below is logged before it's returned. A 400 here is
  // a relative who tried to get in and didn't -- from the archivist's
  // side that is indistinguishable from nobody having tried at all,
  // since no notification is sent for a request that never got created.
  // The log line is the only trace such an attempt leaves.
  if (!name || !email || !connection || !recaptchaToken) {
    log.warn('request-access.invalid', {
      reason: 'missing-fields',
      // Which fields, not their values -- enough to tell a broken form
      // from a broken submitter without copying the body into the log.
      missing: Object.entries({ name, email, connection, recaptchaToken })
        .filter(([, v]) => !v)
        .map(([k]) => k),
    })
    return jsonResponse(400, {
      error: 'name, email, connection, and recaptchaToken are all required',
    })
  }
  if (!EMAIL_PATTERN.test(email)) {
    log.warn('request-access.invalid', { reason: 'malformed-email', email })
    return jsonResponse(400, {
      error: "That email address doesn't look right -- please check it and try again.",
    })
  }
  if (name.length > MAX_NAME_LENGTH) {
    log.warn('request-access.invalid', {
      reason: 'name-too-long',
      email,
      length: name.length,
    })
    return jsonResponse(400, {
      error: `Please keep the name under ${MAX_NAME_LENGTH} characters.`,
    })
  }
  if (connection.length > MAX_CONNECTION_LENGTH) {
    log.warn('request-access.invalid', {
      reason: 'connection-too-long',
      email,
      length: connection.length,
    })
    return jsonResponse(400, {
      error: `Please keep the description of how you're connected under ${MAX_CONNECTION_LENGTH} characters.`,
    })
  }

  const secret = await getRecaptchaSecret()
  const result = await verifyRecaptcha(recaptchaToken, secret)
  if (!isVerificationAcceptable(result, RECAPTCHA_SCORE_THRESHOLD)) {
    // Diagnosing the launch-day failures meant inferring from indirect
    // evidence and landing on the wrong theory twice, because nothing
    // recorded *why* Google said no. The score in particular is what
    // RECAPTCHA_SCORE_THRESHOLD should be tuned against -- never the
    // token, which is a credential.
    log.warn('recaptcha.rejected', {
      email,
      success: result.success,
      score: result.score,
      action: result.action,
      hostname: result.hostname,
      errorCodes: result['error-codes'],
      threshold: RECAPTCHA_SCORE_THRESHOLD,
    })
    // Distinguishes "Google declined you" from "this site is
    // misconfigured", which the previous single message conflated -- a
    // domain misconfiguration told real relatives that *they* had failed
    // verification, with no hint it was our problem and not theirs.
    const misconfigured = (result['error-codes'] ?? []).some((c) =>
      ['invalid-input-secret', 'bad-request', 'invalid-keys'].includes(c),
    )
    return jsonResponse(400, {
      error: misconfigured
        ? "Something is misconfigured on our end, and it's not your fault -- please email the Archivist at FrauErica.archivist@gmail.com and we'll sort it out."
        : "We couldn't verify this request automatically. Please try again, or email the Archivist at FrauErica.archivist@gmail.com and we'll set you up directly.",
    })
  }

  const userPoolId = requireEnv('COGNITO_USER_POOL_ID')

  let cognitoError: unknown = null
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:requester_name', Value: name },
          { Name: 'custom:connection', Value: connection },
        ],
        // Suppress Cognito's own invitation email -- this account has no
        // usable credentials yet (a real, but never-communicated,
        // auto-generated temp password) until an admin actually
        // approves it. adminApproveUser.ts's MessageAction: 'RESEND' is
        // the first time this person ever receives real login
        // credentials, not this call.
        MessageAction: 'SUPPRESS',
      }),
    )
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: GROUPS.PENDING,
      }),
    )
  } catch (err) {
    if (err instanceof UsernameExistsException) {
      // Already requested before (or already has an account entirely) --
      // resubmitting shouldn't look like an error to the requester.
      // Deliberately doesn't touch existing group membership: someone
      // who's already approved re-submitting this form must not be
      // silently added back to 'pending'.
      // Logged at info because it is genuinely routine, but it's worth
      // recording: a relative resubmitting repeatedly is usually a
      // person who thinks nothing happened the first time and is one
      // useful nudge away from giving up.
      log.info('request-access.duplicate', { email })
    } else {
      // Held rather than rethrown: whatever went wrong with Cognito, the
      // archivist still needs to hear that someone asked for access --
      // that notification is the only signal a request ever happened, and
      // losing it means the person waits forever on a request nobody
      // knows about. Rethrown below, after the email is away.
      cognitoError = err
      log.error('request-access.cognito-failed', err, { email })
    }
  }

  const frontendOrigin = requireEnv('FRONTEND_ORIGIN')

  try {
    await sendAdminNotification({ name, email, connection }, frontendOrigin)
  } catch (err) {
    // The worst failure this route has, and previously the quietest: the
    // account now exists in 'pending' but nothing told the archivist to
    // go approve it, so the request lands in a state where the requester
    // is waiting and nobody knows to act. Rethrown (the requester should
    // not be told this worked), but logged first with the details needed
    // to approve them by hand -- this line is the notification when the
    // notification itself is what broke.
    log.error('request-access.notification-failed', err, { email, name, connection })
    throw err
  }

  // Surfaced only after the archivist has been notified. The requester
  // does need to see a failure here -- without a Cognito account, the
  // approve flow has nothing to approve, so this genuinely needs a retry
  // or manual intervention rather than a falsely reassuring 200.
  if (cognitoError) throw cognitoError

  log.info('request-access.accepted', { email })
  return jsonResponse(200, { ok: true })
}

export const handler = withLogging('request-access', baseHandler)
