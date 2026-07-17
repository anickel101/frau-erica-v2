import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { requireEnv } from './env'

const ssm = new SSMClient({})

// Cached at module scope, same pattern as db.ts's snapshotPath -- only a
// cold start pays the fetch/decrypt cost. Reset to null on failure so a
// transient SSM error doesn't get replayed forever on a warm container.
let recaptchaSecret: Promise<string> | null = null

export function getRecaptchaSecret(): Promise<string> {
  if (!recaptchaSecret) {
    recaptchaSecret = fetchRecaptchaSecret().catch((err: unknown) => {
      recaptchaSecret = null
      throw err
    })
  }
  return recaptchaSecret
}

async function fetchRecaptchaSecret(): Promise<string> {
  const name = requireEnv('RECAPTCHA_SECRET_PARAM')

  const response = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  )
  const value = response.Parameter?.Value
  if (!value) {
    throw new Error(`SSM parameter ${name} has no value`)
  }
  return value
}
