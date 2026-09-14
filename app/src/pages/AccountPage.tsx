import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { buttonClassName, inputClassName } from '../utils/formStyles'

// The real Cognito policy on this pool, read from
// describe-user-pool rather than guessed. Shown BEFORE submitting:
// failing against an invisible rule and getting Cognito's own error
// string back is the pattern that made the reCAPTCHA failure
// unreadable, and this form is used by people who were handed a
// temporary password and have to change it.
const PASSWORD_RULES = [
  'at least 8 characters',
  'an uppercase and a lowercase letter',
  'a number',
  'a symbol',
]

// Cognito's messages are accurate but written for a developer. These are
// the three a person will actually hit.
function friendlyError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name === 'NotAuthorizedException') {
    return 'That current password is not right.'
  }
  if (name === 'InvalidPasswordException' || name === 'InvalidParameterException') {
    return `That new password does not meet the requirements: ${PASSWORD_RULES.join(', ')}.`
  }
  if (name === 'LimitExceededException') {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  return message || 'Something went wrong. Please try again.'
}

export default function AccountPage() {
  const { email, personName, changePassword, logoutEverywhere } = useAuth()
  const navigate = useNavigate()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    // Checked here rather than left to Cognito: the two fields are a
    // local typo guard, and Cognito has no idea the second one exists.
    if (next !== confirm) {
      setError('The two new passwords do not match.')
      return
    }
    if (next === current) {
      setError('That is the password you already have.')
      return
    }

    setSubmitting(true)
    try {
      await changePassword(current, next)
      setDone(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (caught: unknown) {
      setError(friendlyError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="p-6 max-w-xl">
        <h1 className="text-2xl font-bold mb-1">Your account</h1>
        <p className="text-sm text-fe-ink/70 mb-6">
          {personName ? `${personName} — ` : ''}
          {email}
        </p>

        <h2 className="text-lg font-bold text-fe-brown mb-2">Change your password</h2>

        {done ? (
          <>
            <p className="mb-4 text-sm">Your password has been changed.</p>
            {/* Offered rather than done automatically. Signing every
                device out is usually WHY someone changes their password
                -- a shared family computer they were left signed in on
                -- but Cognito does not do it, and doing it silently
                would sign them out of this page mid-sentence. */}
            <p className="mb-4 text-sm text-fe-ink/70">
              You are still signed in everywhere else you were before. If you changed it
              because someone else might have been signed in as you, sign those sessions
              out too.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={buttonClassName}
                onClick={() => {
                  void logoutEverywhere()
                  navigate('/login')
                }}
              >
                Sign out everywhere
              </button>
              <button
                type="button"
                className="text-sm text-fe-link hover:text-fe-link-dark underline"
                onClick={() => setDone(false)}
              >
                Change it again
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm mb-1">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm mb-1">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className={inputClassName}
                aria-describedby="password-rules"
              />
              <p id="password-rules" className="mt-1 text-xs text-fe-ink/60">
                Needs {PASSWORD_RULES.join(', ')}.
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm mb-1">
                New password again
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClassName}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className={buttonClassName}>
              {submitting ? 'Changing...' : 'Change password'}
            </button>
          </form>
        )}

        <p className="mt-8 text-sm text-fe-ink/70">
          Can't remember your current password?{' '}
          <Link to="/login" className="text-fe-link hover:text-fe-link-dark">
            The login page can email you a reset code
          </Link>
          .
        </p>
      </div>
    </Layout>
  )
}
