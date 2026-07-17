import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { buttonClassName, inputClassName } from '../utils/formStyles'

type Step =
  'credentials' | 'newPassword' | 'forgotPasswordRequest' | 'forgotPasswordConfirm'

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="text-sm text-red-700">{error}</p> : null
}

function CredentialsStep({
  email,
  setEmail,
  password,
  setPassword,
  resetMessage,
  error,
  submitting,
  onSubmit,
  onForgotPassword,
}: {
  email: string
  setEmail: (value: string) => void
  password: string
  setPassword: (value: string) => void
  resetMessage: string | null
  error: string | null
  submitting: boolean
  onSubmit: (e: FormEvent) => void
  onForgotPassword: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="block text-sm font-bold mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-bold mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClassName}
        />
      </div>
      {resetMessage && <p className="text-sm text-green-700">{resetMessage}</p>}
      <ErrorLine error={error} />
      <div className="flex items-center gap-4">
        <button type="submit" disabled={submitting} className={buttonClassName}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-fe-accent hover:text-fe-accent-dark"
        >
          Forgot password?
        </button>
      </div>
    </form>
  )
}

function NewPasswordStep({
  newPassword,
  setNewPassword,
  error,
  submitting,
  onSubmit,
}: {
  newPassword: string
  setNewPassword: (value: string) => void
  error: string | null
  submitting: boolean
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-fe-ink/80">
        This is your first time signing in -- choose a new password to finish setting up
        your account.
      </p>
      <div>
        <label htmlFor="newPassword" className="block text-sm font-bold mb-1">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClassName}
        />
      </div>
      <ErrorLine error={error} />
      <button type="submit" disabled={submitting} className={buttonClassName}>
        {submitting ? 'Setting password...' : 'Set password and log in'}
      </button>
    </form>
  )
}

function ForgotPasswordRequestStep({
  email,
  setEmail,
  error,
  submitting,
  onSubmit,
  onBack,
}: {
  email: string
  setEmail: (value: string) => void
  error: string | null
  submitting: boolean
  onSubmit: (e: FormEvent) => void
  onBack: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-fe-ink/80">
        Enter your email and we'll send a code to reset your password.
      </p>
      <div>
        <label htmlFor="resetEmail" className="block text-sm font-bold mb-1">
          Email
        </label>
        <input
          id="resetEmail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </div>
      <ErrorLine error={error} />
      <div className="flex items-center gap-4">
        <button type="submit" disabled={submitting} className={buttonClassName}>
          {submitting ? 'Sending...' : 'Send reset code'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-fe-accent hover:text-fe-accent-dark"
        >
          Back to log in
        </button>
      </div>
    </form>
  )
}

function ForgotPasswordConfirmStep({
  email,
  resetCode,
  setResetCode,
  resetPassword,
  setResetPassword,
  error,
  submitting,
  onSubmit,
}: {
  email: string
  resetCode: string
  setResetCode: (value: string) => void
  resetPassword: string
  setResetPassword: (value: string) => void
  error: string | null
  submitting: boolean
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-fe-ink/80">
        Enter the code we sent to {email} along with your new password.
      </p>
      <div>
        <label htmlFor="resetCode" className="block text-sm font-bold mb-1">
          Code
        </label>
        <input
          id="resetCode"
          type="text"
          required
          value={resetCode}
          onChange={(e) => setResetCode(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="resetPassword" className="block text-sm font-bold mb-1">
          New password
        </label>
        <input
          id="resetPassword"
          type="password"
          required
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
          className={inputClassName}
        />
      </div>
      <ErrorLine error={error} />
      <button type="submit" disabled={submitting} className={buttonClassName}>
        {submitting ? 'Resetting...' : 'Reset password'}
      </button>
    </form>
  )
}

export default function LoginForm() {
  const { login, completeNewPassword, requestPasswordReset, confirmPasswordReset } =
    useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await login(email, password)
      if (result.outcome === 'newPasswordRequired') {
        setStep('newPassword')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong logging in.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleNewPasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await completeNewPassword(newPassword)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the new password.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPasswordRequestSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setStep('forgotPasswordConfirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPasswordConfirmSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await confirmPasswordReset(email, resetCode, resetPassword)
      setStep('credentials')
      setPassword('')
      setResetCode('')
      setResetPassword('')
      setResetMessage('Password reset -- log in with your new password.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'newPassword') {
    return (
      <NewPasswordStep
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        error={error}
        submitting={submitting}
        onSubmit={handleNewPasswordSubmit}
      />
    )
  }

  if (step === 'forgotPasswordRequest') {
    return (
      <ForgotPasswordRequestStep
        email={email}
        setEmail={setEmail}
        error={error}
        submitting={submitting}
        onSubmit={handleForgotPasswordRequestSubmit}
        onBack={() => {
          setError(null)
          setStep('credentials')
        }}
      />
    )
  }

  if (step === 'forgotPasswordConfirm') {
    return (
      <ForgotPasswordConfirmStep
        email={email}
        resetCode={resetCode}
        setResetCode={setResetCode}
        resetPassword={resetPassword}
        setResetPassword={setResetPassword}
        error={error}
        submitting={submitting}
        onSubmit={handleForgotPasswordConfirmSubmit}
      />
    )
  }

  return (
    <CredentialsStep
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      resetMessage={resetMessage}
      error={error}
      submitting={submitting}
      onSubmit={handleCredentialsSubmit}
      onForgotPassword={() => {
        setError(null)
        setResetMessage(null)
        setStep('forgotPasswordRequest')
      }}
    />
  )
}
