import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ApproveRequestForm from '../components/ApproveRequestForm'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import PersonPicker from '../components/PersonPicker'
import SearchInput from '../components/SearchInput'
import {
  AdminUserSummary,
  listAdminUsers,
  updateUserGroup,
  updateUserPersonId,
} from '../data-access/gated/adminUsers'
import { useAuth } from '../hooks/useAuth'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { PersonSummary } from '../types/person'
import { buttonClassName } from '../utils/formStyles'

interface ApproveTarget {
  email: string
  name?: string
  connection?: string
}

const PENDING_PAGE_SIZE = 10
const EXISTING_USERS_PAGE_SIZE = 10

function filterExistingUsers(
  users: AdminUserSummary[],
  query: string,
): AdminUserSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return users
  return users.filter(
    (u) =>
      u.email.toLowerCase().includes(q) ||
      (u.fullName?.toLowerCase().includes(q) ?? false),
  )
}

export default function AdminUsersPage() {
  const { idToken, email: ownEmail } = useAuth()
  const [searchParams] = useSearchParams()
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [selected, setSelected] = useState<PersonSummary | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingGroupEmail, setConfirmingGroupEmail] = useState<string | null>(null)
  const [changingGroup, setChangingGroup] = useState(false)
  const [showAllPending, setShowAllPending] = useState(false)
  // The deep link in the Request Access admin-notification email sets
  // this via ?email=&name= on first load; clicking "Review & approve" on
  // a Pending requests row below overrides it. Either way, the key prop
  // on ApproveRequestForm forces it to reinitialize from these values.
  const [approveTarget, setApproveTarget] = useState<ApproveTarget>(() => {
    const email = searchParams.get('email')
    const name = searchParams.get('name')
    return email ? { email, name: name ?? undefined } : { email: '' }
  })

  const refreshUsers = useCallback(() => {
    if (!idToken) return
    listAdminUsers(idToken)
      .then(setUsers)
      .catch(() => setError('Could not load users.'))
      .finally(() => setLoading(false))
  }, [idToken])

  useEffect(() => {
    refreshUsers()
  }, [refreshUsers])

  function closeEditModal() {
    setEditingEmail(null)
    setSelected(null)
  }

  async function handleSave(email: string) {
    if (!idToken || !selected) return
    setSaving(true)
    try {
      await updateUserPersonId(email, selected.person_id, idToken)
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, personId: selected.person_id } : u)),
      )
      closeEditModal()
    } catch {
      setError('Could not save the change.')
    } finally {
      setSaving(false)
    }
  }

  async function handleGroupChange(email: string, action: 'promote' | 'demote') {
    if (!idToken) return
    setChangingGroup(true)
    try {
      await updateUserGroup(email, action, idToken)
      setUsers((prev) =>
        prev.map((u) =>
          u.email === email
            ? {
                ...u,
                groups:
                  action === 'promote'
                    ? [...u.groups, 'admin']
                    : u.groups.filter((g) => g !== 'admin'),
              }
            : u,
        ),
      )
      setConfirmingGroupEmail(null)
    } catch {
      setError('Could not change the group.')
    } finally {
      setChangingGroup(false)
    }
  }

  const pendingUsers = users.filter((u) => u.groups.includes('pending'))
  const existingUsers = users.filter((u) => !u.groups.includes('pending'))
  const visiblePending = showAllPending
    ? pendingUsers
    : pendingUsers.slice(0, PENDING_PAGE_SIZE)
  const editingUser = existingUsers.find((u) => u.email === editingEmail) ?? null
  const confirmingUser =
    existingUsers.find((u) => u.email === confirmingGroupEmail) ?? null
  const confirmingIsAdmin = confirmingUser?.groups.includes('admin') ?? false

  const {
    query: existingQuery,
    setQuery: setExistingQuery,
    filtered: filteredExisting,
    visible: visibleExisting,
    showAll: showAllExisting,
    setShowAll: setShowAllExisting,
  } = usePaginatedSearch(existingUsers, filterExistingUsers, EXISTING_USERS_PAGE_SIZE)

  if (!idToken) return null

  return (
    <Layout>
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Manage users</h1>

        <p className="text-sm text-fe-ink/80 mb-8">
          When someone requests access, they show up below under Pending requests -- click
          Review &amp; approve to fill in the form. You'll also still get an email the
          moment they submit. Once someone has an account, you can fix a wrong person_id
          or change their admin status further down.
        </p>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Pending requests</h2>

          {loading && <p className="text-sm text-fe-ink/60">Loading...</p>}

          {!loading && pendingUsers.length === 0 && (
            <p className="text-sm text-fe-ink/60">No pending requests right now.</p>
          )}

          {!loading && pendingUsers.length > 0 && (
            <>
              <ul className="space-y-3">
                {visiblePending.map((user) => (
                  <li
                    key={user.email}
                    className="border border-fe-brown/20 rounded-sm p-3"
                  >
                    <p className="text-sm font-bold">
                      {user.requesterName ?? user.email}
                    </p>
                    <p className="text-sm text-fe-ink/70">{user.email}</p>
                    {user.connection && (
                      <p className="text-sm text-fe-ink/80 mt-1">{user.connection}</p>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setApproveTarget({
                          email: user.email,
                          name: user.requesterName ?? undefined,
                          connection: user.connection ?? undefined,
                        })
                      }
                      className="text-fe-accent hover:text-fe-accent-dark text-sm mt-2"
                    >
                      Review &amp; approve
                    </button>
                  </li>
                ))}
              </ul>

              {pendingUsers.length > PENDING_PAGE_SIZE && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAllPending((v) => !v)}
                    className="text-sm text-fe-ink/60 hover:text-fe-ink underline"
                  >
                    {showAllPending ? 'Show less' : `Show all (${pendingUsers.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Approve a new request</h2>
          <ApproveRequestForm
            key={approveTarget.email}
            idToken={idToken}
            initialEmail={approveTarget.email}
            initialName={approveTarget.name}
            initialConnection={approveTarget.connection}
            onApproved={refreshUsers}
          />
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Existing users</h2>

          {error && <p className="text-sm text-red-700">{error}</p>}

          {!loading && (
            <>
              <div className="mb-4">
                <SearchInput
                  value={existingQuery}
                  onChange={setExistingQuery}
                  placeholder="Search by name or email..."
                />
              </div>

              {filteredExisting.length === 0 ? (
                <p className="text-sm text-fe-ink/60">No matching users.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-fe-brown/30">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Groups</th>
                      <th className="py-2 pr-4">person_id</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleExisting.map((user) => {
                      const isAdmin = user.groups.includes('admin')
                      return (
                        <tr
                          key={user.email}
                          className="border-b border-fe-brown/10 align-top"
                        >
                          <td className="py-2 pr-4">{user.fullName ?? '—'}</td>
                          <td className="py-2 pr-4">{user.email}</td>
                          <td className="py-2 pr-4">{user.groups.join(', ')}</td>
                          <td className="py-2 pr-4">{user.personId ?? '—'}</td>
                          <td className="py-2">
                            <div className="flex flex-col items-start gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingEmail(user.email)}
                                className="text-fe-accent hover:text-fe-accent-dark text-sm"
                              >
                                Edit person_id
                              </button>
                              {/* No group action at all on the signed-in
                                  admin's own row -- self-protection
                                  against a stray click locking the only
                                  admin out (also enforced server-side). */}
                              {user.email !== ownEmail && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmingGroupEmail(user.email)}
                                  className="text-fe-accent hover:text-fe-accent-dark text-sm"
                                >
                                  {isAdmin ? 'Demote to approved' : 'Promote to admin'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {filteredExisting.length > EXISTING_USERS_PAGE_SIZE && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAllExisting((v) => !v)}
                    className="text-sm text-fe-ink/60 hover:text-fe-ink underline"
                  >
                    {showAllExisting
                      ? 'Show less'
                      : `Show all (${filteredExisting.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Modal open={editingEmail !== null} onClose={closeEditModal}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-fe-bg rounded-sm p-6 max-w-md w-full"
        >
          <h3 className="text-lg font-bold mb-1">Edit person_id</h3>
          <p className="text-sm text-fe-ink/70 mb-4">{editingUser?.email}</p>
          <PersonPicker idToken={idToken} selected={selected} onSelect={setSelected} />
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => editingEmail && handleSave(editingEmail)}
              disabled={!selected || saving}
              className={buttonClassName}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={closeEditModal}
              className="px-4 py-2 rounded-sm text-sm border border-fe-brown/40"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmingGroupEmail !== null}
        onClose={() => setConfirmingGroupEmail(null)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-fe-bg rounded-sm p-6 max-w-md w-full"
        >
          <p className="text-sm mb-4">
            {confirmingIsAdmin
              ? `Remove admin access from ${confirmingUser?.email}?`
              : `Grant admin access to ${confirmingUser?.email}?`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                confirmingGroupEmail &&
                handleGroupChange(
                  confirmingGroupEmail,
                  confirmingIsAdmin ? 'demote' : 'promote',
                )
              }
              disabled={changingGroup}
              className={buttonClassName}
            >
              {changingGroup ? 'Saving...' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingGroupEmail(null)}
              className="px-4 py-2 rounded-sm text-sm border border-fe-brown/40"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
