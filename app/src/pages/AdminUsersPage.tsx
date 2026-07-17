import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import PersonPicker from '../components/PersonPicker'
import {
  AdminUserSummary,
  listAdminUsers,
  updateUserPersonId,
} from '../data-access/gated/adminUsers'
import { useAuth } from '../hooks/useAuth'
import { PersonSummary } from '../types/person'
import { compactButtonClassName } from '../utils/formStyles'

export default function AdminUsersPage() {
  const { idToken } = useAuth()
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [selected, setSelected] = useState<PersonSummary | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!idToken) return
    listAdminUsers(idToken)
      .then(setUsers)
      .catch(() => setError('Could not load users.'))
      .finally(() => setLoading(false))
  }, [idToken])

  async function handleSave(email: string) {
    if (!idToken || !selected) return
    setSaving(true)
    try {
      await updateUserPersonId(email, selected.person_id, idToken)
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, personId: selected.person_id } : u)),
      )
      setEditingEmail(null)
      setSelected(null)
    } catch {
      setError('Could not save the change.')
    } finally {
      setSaving(false)
    }
  }

  if (!idToken) return null

  return (
    <Layout>
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Manage existing users</h1>

        {loading && <p className="text-sm text-fe-ink/60">Loading...</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}

        {!loading && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-fe-brown/30">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Groups</th>
                <th className="py-2 pr-4">person_id</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email} className="border-b border-fe-brown/10 align-top">
                  <td className="py-2 pr-4">{user.email}</td>
                  <td className="py-2 pr-4">{user.groups.join(', ')}</td>
                  <td className="py-2 pr-4">{user.personId ?? '—'}</td>
                  <td className="py-2">
                    {editingEmail === user.email ? (
                      <div className="max-w-xs">
                        <PersonPicker
                          idToken={idToken}
                          selected={selected}
                          onSelect={setSelected}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => handleSave(user.email)}
                            disabled={!selected || saving}
                            className={compactButtonClassName}
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmail(null)
                              setSelected(null)
                            }}
                            className="px-3 py-1.5 rounded-sm text-sm border border-fe-brown/40"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingEmail(user.email)}
                        className="text-fe-accent hover:text-fe-accent-dark text-sm"
                      >
                        Edit person_id
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="text-sm mt-8">
          <Link to="/admin/approve" className="text-fe-accent hover:text-fe-accent-dark">
            Approve a new request
          </Link>
        </p>
      </div>
    </Layout>
  )
}
