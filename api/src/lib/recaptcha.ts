export interface RecaptchaResult {
  success: boolean
  score?: number
  action?: string
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
}

export async function verifyRecaptcha(
  token: string,
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RecaptchaResult> {
  const response = await fetchImpl('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }).toString(),
  })
  return response.json() as Promise<RecaptchaResult>
}

// Pure decision function, separated so it's testable without any
// network involved. 0.5 is reCAPTCHA v3's own documented default
// threshold. Fail closed: a missing score or success:false rejects.
export function isVerificationAcceptable(
  result: RecaptchaResult,
  threshold = 0.5,
): boolean {
  if (!result.success) return false
  if (typeof result.score !== 'number') return false
  return result.score >= threshold
}
