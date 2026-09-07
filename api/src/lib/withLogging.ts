import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { log } from './log'

// Wraps a handler so failures and refusals carry context.
//
// Lambda already writes an unhandled throw to CloudWatch by itself, so
// this is not about capturing the stack -- it's about capturing *who*
// and *what*: a stack trace saying getFamilyById threw is far less
// useful than one that also names the caller and the family id, which
// is the difference between reproducing a report and guessing at it.
//
// A wrapper rather than a try/catch in each of the twelve handlers,
// because the interesting part of a handler is its authorization guard
// and its query -- burying those in boilerplate to get logging would be
// a bad trade, and one skipped catch block is an invisible gap.
//
// Deliberately does NOT log successful (2xx) responses. Lambda's own
// REPORT line already records duration, memory and cold-start time for
// every invocation, so a per-request INFO line would multiply log
// volume to restate what's already there. What isn't already there is
// the reason behind a refusal.
//
// Errors are rethrown, never swallowed. API Gateway must still turn
// them into a 500 -- a handler that logged an error and then returned
// as though nothing happened would be strictly worse than one that
// crashed loudly.

type AnyEvent = APIGatewayProxyEventV2 | APIGatewayProxyEventV2WithJWTAuthorizer

// APIGatewayProxyResultV2 permits a bare string (a raw body with an
// implied 200). Every handler here returns the structured form via
// jsonResponse, but the type allows both, so this narrows rather than
// asserts -- a string result simply has no status code to report on.
function statusOf(result: APIGatewayProxyResultV2): number | undefined {
  if (typeof result === 'string') return undefined
  return (result as APIGatewayProxyStructuredResultV2).statusCode
}

// The Cognito `sub` -- a stable, opaque user id -- rather than the
// email. It's enough to correlate every log line from one person's
// session and to look them up in the user pool when someone reports a
// problem, without copying an address into every 403 line. The email is
// logged only where it's the actual subject of the event (an access
// request, an admin acting on an account), not merely incidental to it.
//
// Absent on /request-access, which has no authorizer and no account yet
// -- hence the defensive read rather than a direct property access.
//
// requestContext itself is optional-chained, not just its children. The
// type says it's always present and on a real API Gateway event it is,
// but this runs inside the catch path of every route: a logger that can
// itself throw would replace a real error with a misleading one at
// exactly the moment the real error matters most. The handler tests,
// which construct minimal events, caught this immediately.
function callerSub(event: AnyEvent): string | undefined {
  const requestContext = event.requestContext as
    { authorizer?: { jwt?: { claims?: Record<string, unknown> } } } | undefined
  const sub = requestContext?.authorizer?.jwt?.claims?.sub
  return typeof sub === 'string' ? sub : undefined
}

export function withLogging<E extends AnyEvent>(
  route: string,
  inner: (event: E) => Promise<APIGatewayProxyResultV2>,
): (event: E) => Promise<APIGatewayProxyResultV2> {
  return async (event: E) => {
    const context: Record<string, unknown> = {
      route,
      sub: callerSub(event),
      // Path params only. Never the body (it holds names, connection
      // text and reCAPTCHA tokens on /request-access) and never headers
      // (Authorization). Query strings are omitted for the same reason
      // -- /search's `q` is a family member's name.
      params: event.pathParameters,
    }

    try {
      const result = await inner(event)
      const status = statusOf(result)
      // 403 is the one worth having: "I logged in but every page says
      // my account isn't approved" is a support question this answers
      // instantly, by showing whether the request arrived with the
      // groups claim the user expects.
      if (status !== undefined && status >= 400) {
        log.warn('request.refused', { ...context, status })
      }
      return result
    } catch (err) {
      log.error('request.failed', err, context)
      throw err
    }
  }
}
