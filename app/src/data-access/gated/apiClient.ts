import { fetchAuthSession } from 'aws-amplify/auth'
import { API_BASE_URL } from '../../config/cognito'

// Carries the HTTP status alongside the message so callers can
// distinguish "not found" (404) from other failures (403, 500, network)
// without parsing the message text -- FamilyPage/PersonPage need this to
// show "doesn't exist" vs. "something went wrong".
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Lets AuthProvider react to an expired session without this module
// importing React or the auth context (which would be a circular
// dependency -- AuthProvider already imports data-access functions that
// live on top of this file). AuthProvider registers a handler that
// resets auth state, so the Require* gates re-render as the login
// teaser instead of every gated page showing a generic error.
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

// Read the token at request time, never from a cached copy held in React
// state. Cognito ID tokens are valid for 60 minutes by default, so a
// stored string goes stale in any tab left open longer than that;
// fetchAuthSession() returns the current token and transparently renews
// it from the (30-day) refresh token when it's close to expiring.
async function currentIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession()
    return session.tokens?.idToken?.toString() ?? null
  } catch {
    // Not signed in, or the refresh token itself has expired.
    return null
  }
}

const SESSION_EXPIRED = 'Your session has expired -- please log in again.'

// Without this a stalled connection never settles: fetch has no default
// timeout, so the promise simply never resolves and the calling page sits
// on "Loading..." indefinitely with no error and no way to retry short of
// a manual reload. Dropped connections on flaky mobile networks are the
// usual cause, and they leave no trace in the console.
//
// 20s is deliberately well clear of a slow-but-working request rather
// than tuned tightly: the API's Lambdas are capped at 10s (template.yaml's
// Globals.Function.Timeout), so API Gateway returns a 504 of its own
// before this fires. Anything still outstanding at 20s is a stalled
// connection, not a slow query -- including the worst legitimate case, a
// cold start with an S3 snapshot download, which real CloudWatch timings
// put around 2s.
const REQUEST_TIMEOUT_MS = 20_000

// AbortController + setTimeout rather than the tidier
// AbortSignal.timeout(): that static needs Safari 16+/Chrome 103+, and
// this site's audience skews elderly and toward older devices, where an
// unhandled TypeError would break every gated page rather than degrade.
// The manual version works everywhere fetch does.
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    // An abort is indistinguishable from any other network failure by
    // the time it reaches the caller, so it's translated here into
    // something a reader can act on. 408 rather than 0 so callers can
    // treat it as the transient, retry-worthy failure it usually is.
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(
        408,
        'This is taking longer than expected -- please check your connection and try again.',
      )
    }
    // fetch rejects with a bare TypeError for any network-level failure
    // (offline, DNS, CORS). "Failed to fetch" is not a useful thing to
    // show someone.
    if (err instanceof TypeError) {
      throw new ApiError(0, "Couldn't reach the archive -- please check your connection.")
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function apiFetch<T>(
  path: string,
  options?: {
    method?: string
    body?: unknown
    // Defaults to true: failing closed is safer than accidentally
    // sending an unauthenticated request to a gated route. Only
    // /request-access (Authorizer: NONE, the requester has no account
    // yet) passes false.
    authenticated?: boolean
  },
): Promise<T> {
  const authenticated = options?.authenticated ?? true

  let idToken: string | null = null
  if (authenticated) {
    idToken = await currentIdToken()
    if (!idToken) {
      onUnauthorized?.()
      throw new ApiError(401, SESSION_EXPIRED)
    }
  }

  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    onUnauthorized?.()
    throw new ApiError(401, SESSION_EXPIRED)
  }
  if (!res.ok) {
    throw new ApiError(res.status, await describeError(path, res))
  }
  return res.json() as Promise<T>
}

// Every handler in api/ responds to a failure with jsonResponse(status,
// { error: '...' }) -- surfacing that message (e.g. "reCAPTCHA
// verification failed") is far more useful to show a user than the bare
// status code. Falls back to the status code if the body isn't JSON or
// doesn't have the expected shape.
async function describeError(path: string, res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'error' in body) {
      const { error } = body as { error: unknown }
      if (typeof error === 'string') return error
    }
  } catch {
    // Body wasn't JSON -- fall through to the generic message below.
  }
  return `API request to ${path} failed: ${res.status}`
}
