import { FormEvent, useState } from 'react'
import Layout from '../components/Layout'
import { RECAPTCHA_SITE_KEY } from '../config/recaptcha'
import { requestAccess } from '../data-access/gated/requestAccess'
import { buttonClassName, inputClassName } from '../utils/formStyles'
import { executeRecaptcha } from '../utils/recaptcha'

export default function RequestAccessPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [connection, setConnection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const recaptchaToken = await executeRecaptcha(RECAPTCHA_SITE_KEY, 'request_access')
      await requestAccess(name, email, connection, recaptchaToken)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Layout>
        <div className="p-6 max-w-2xl">
          <h1 className="text-2xl font-bold mb-4">Request sent</h1>
          <p>
            Thanks -- your request has been sent to the Archivist. If you're on the family
            tree, you'll hear back with login instructions once it's reviewed.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Request access</h1>
        <p className="mb-6 text-sm text-fe-ink/80">
          If you believe you're on a branch of the Mueller family tree, tell us how you
          connect to it and we'll be in touch.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
          <div>
            <label htmlFor="name" className="block text-sm font-bold mb-1">
              Your name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-bold mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="connection" className="block text-sm font-bold mb-1">
              How do you connect to the family tree?
            </label>
            <textarea
              id="connection"
              required
              rows={4}
              value={connection}
              onChange={(e) => setConnection(e.target.value)}
              placeholder="Your full name and whatever you know about your Mueller forebears is a good place to start."
              className={inputClassName}
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={submitting} className={buttonClassName}>
            {submitting ? 'Sending...' : 'Send request'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
