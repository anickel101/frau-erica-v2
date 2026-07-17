import { apiFetch } from './apiClient'

// The one route in this folder that needs no idToken -- the requester
// has no account yet (see api/template.yaml's Auth: Authorizer: NONE
// override for /request-access) -- but it talks to the same API and
// benefits from apiFetch's shared error handling, so it lives alongside
// the rest of the gated data-access layer rather than duplicating fetch.
export function requestAccess(
  name: string,
  email: string,
  connection: string,
  recaptchaToken: string,
): Promise<void> {
  return apiFetch('/request-access', undefined, {
    method: 'POST',
    body: { name, email, connection, recaptchaToken },
  })
}
