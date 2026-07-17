import { FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PersonPicker from '../components/PersonPicker'
import { approveUser } from '../data-access/gated/adminApprove'
import { useAuth } from '../hooks/useAuth'
import { PersonSummary } from '../types/person'
import { buttonClassName, inputClassName } from '../utils/formStyles'

export default function AdminApprovePage() {
  const { idToken } = useAuth()
  const [searchParams] = useSearchParams()
  const prefilledEmail = searchParams.get('email') ?? ''
  const prefilledName = searchParams.get('name') ?? undefined

  const [email, setEmail] = useState(prefilledEmail)
  const [selected, setSelected] = useState<PersonSummary | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleApprove() {
    if (!idToken || !selected) return
    setSubmitting(true)
    setError(null)
    try {
      await approveUser(email, selected.person_id, idToken)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setConfirming(true)
  }

  if (done) {
    return (
      <Layout>
        <div className="p-6 max-w-2xl">
          <h1 className="text-2xl font-bold mb-4">Approved</h1>
          <p>
            {email} has been granted access and should receive an invitation email
            shortly.
          </p>
        </div>
      </Layout>
    )
  }

  // Satisfies types -- RequireAdmin guarantees a signed-in admin got
  // this far, so idToken is always set in practice.
  if (!idToken) return null

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Approve a request</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-bold mb-1">Who is this?</label>
            <PersonPicker
              idToken={idToken}
              initialQuery={prefilledName}
              selected={selected}
              onSelect={setSelected}
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          {!confirming ? (
            <button type="submit" disabled={!selected} className={buttonClassName}>
              Continue
            </button>
          ) : (
            <div className="border border-fe-brown/30 rounded-sm p-4 bg-fe-bg">
              <p className="text-sm mb-3">
                Grant <strong>{email}</strong> access as{' '}
                <strong>
                  {selected?.first_name} {selected?.last_name}
                </strong>{' '}
                (person_id {selected?.person_id})?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={submitting}
                  className={buttonClassName}
                >
                  {submitting ? 'Approving...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 rounded-sm text-sm border border-fe-brown/40"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="text-sm mt-8">
          <Link to="/admin/users" className="text-fe-accent hover:text-fe-accent-dark">
            Manage existing users
          </Link>
        </p>
      </div>
    </Layout>
  )
}
