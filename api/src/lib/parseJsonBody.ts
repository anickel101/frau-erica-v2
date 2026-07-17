// Every handler accepting a POST/PATCH body was hand-rolling the same
// try/catch around JSON.parse -- centralized so the "invalid JSON" 400
// wording stays identical everywhere. Returns null on a parse failure;
// callers are expected to respond 400 in that case (they own the
// response shape, this stays a pure parsing concern).
export function parseJsonBody<T>(body: string | undefined): T | null {
  try {
    return JSON.parse(body ?? '{}') as T
  } catch {
    return null
  }
}
