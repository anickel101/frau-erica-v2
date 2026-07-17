import { API_BASE_URL } from '../../config/cognito'

// idToken is optional -- /request-access is the one route on this API
// with no authorizer (the requester has no account yet), so it needs to
// go through the same fetch/error-handling machinery without a token.
export async function apiFetch<T>(
  path: string,
  idToken?: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    throw new Error(await describeError(path, res))
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

export interface MeResponse {
  sub: string
  email: string
  groups: string[]
  personId: number | null
}

export function getMe(idToken: string): Promise<MeResponse> {
  return apiFetch<MeResponse>('/me', idToken)
}
