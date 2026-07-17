import { FormEvent, useState } from 'react'
import PersonPicker from './PersonPicker'
import { approveUser } from '../data-access/gated/adminApprove'
import { PersonSummary } from '../types/person'
import { buttonClassName, inputClassName } from '../utils/formStyles'

// initialEmail/initialName/initialConnection come from whichever request
// prompted opening this form -- either the Request Access admin-notification
// email's deep link (?email=&name= on the page URL, read by the parent)
// or a "Review & approve" click on a row in the Pending requests list
// below, which also has the connection text to show here. Either way,
// approving is "open the email or the pending row, confirm, click
// Approve," nothing else.
export default function ApproveRequestForm({
  idToken,
  initialEmail = '',
  initialName,
  initialConnection,
  onApproved,
}: {
  idToken: string
  initialEmail?: string
  initialName?: string
  initialConnection?: string
  onApproved: () => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [selected, setSelected] = useState<PersonSummary | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function handleApprove() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      await approveUser(email, selected.person_id, idToken)
      setDone(email)
      setEmail('')
      setSelected(null)
      setConfirming(false)
      onApproved()
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

  return (
    <div>
      {done && (
        <p className="text-sm text-green-700 mb-4">
          {done} has been granted access and should receive an invitation email shortly.
        </p>
      )}

      {initialConnection && (
        <p className="text-sm text-fe-ink/80 mb-4 border border-fe-brown/20 rounded-sm p-3 bg-fe-bg">
          How they say they connect to the family: <em>{initialConnection}</em>
        </p>
      )}

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
            initialQuery={initialName}
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
    </div>
  )
}
