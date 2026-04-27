'use client'

import { useEffect, useState } from 'react'
import { adminApi, ApiError } from '@/lib/api'
import { useRouter } from 'next/navigation'

type AdminUser = {
  id: string
  name: string
  email: string
  role: 'OWNER' | 'BRANCH_OWNER' | 'STAFF' | 'ADMIN'
  tenantId: string
  createdAt: string
  tenant?: {
    cafeName: string
    planType: 'TRIAL' | 'PAID' | null
    currentSubscriptionEnd: string | null
  } | null
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [items, setItems] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
   const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [tempPasswordUser, setTempPasswordUser] = useState<AdminUser | null>(null)
  const [savingTemp, setSavingTemp] = useState(false)

  useEffect(() => {
    // Basic client-side guard for better UX.
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token || role !== 'ADMIN') {
      router.replace('/admin/login')
    }
  }, [router])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await adminApi.getUsers()
        if (cancelled) return
        setItems(Array.isArray(data) ? data : [])
      } catch (err: unknown) {
        if (cancelled) return
        const message =
          err instanceof ApiError ? err.message : 'Unable to load users. Please try again.'
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const openTempPasswordDialog = (user: AdminUser) => {
    setTempPasswordUser(user)
    setTempPassword('')
    setActionError(null)
    setActionMessage(null)
  }

  const handleSetTempPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempPasswordUser) return
    if (tempPassword.length < 6) {
      setActionError('Temporary password must be at least 6 characters.')
      return
    }
    setSavingTemp(true)
    setActionError(null)
    try {
      await adminApi.setUserTempPassword(tempPasswordUser.id, tempPassword)
      setActionMessage(
        `Temporary password set for ${tempPasswordUser.name}. Share it with the user and ask them to log in.`
      )
      setTempPasswordUser(null)
      setTempPassword('')
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to set temporary password.'
      setActionError(message)
    } finally {
      setSavingTemp(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900/95 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
            Hello Café · Admin
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
            All users
          </h1>
          <p className="mt-2 text-sm text-slate-300 max-w-2xl">
            View all registered users across cafes, including their role, cafe, and
            subscription status.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/80 bg-red-500/10 px-3 py-2.5 text-sm text-red-100">
            {error}
          </div>
        )}

        {actionMessage && (
          <div className="mb-4 rounded-lg border border-emerald-400/80 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100">
            {actionMessage}
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-lg border border-red-400/80 bg-red-500/10 px-3 py-2.5 text-sm text-red-100">
            {actionError}
          </div>
        )}

        <div className="rounded-2xl border border-slate-700 bg-slate-950/80 shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-4 text-sm text-slate-200">Loading users...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-200">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-slate-900 text-xs uppercase text-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Cafe</th>
                    <th className="px-4 py-3 font-semibold">Subscription</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                  {items.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-50">{user.name}</div>
                        <div className="text-[11px] text-slate-300">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-100">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-50">
                          {user.tenant?.cafeName ?? '—'}
                        </div>
                        <div className="text-[11px] text-slate-400">{user.tenantId}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-[11px] text-slate-200">
                        {user.tenant?.planType ? (
                          <>
                            <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-100 mr-1">
                              {user.tenant.planType === 'TRIAL' ? 'Free trial' : 'Paid'}
                            </span>
                            <div className="mt-1">
                              <span className="text-slate-400">Until:</span>{' '}
                              <span className="text-slate-100">
                                {user.tenant.currentSubscriptionEnd
                                  ? new Date(
                                      user.tenant.currentSubscriptionEnd
                                    ).toLocaleDateString()
                                  : 'N/A'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-[11px] text-slate-300 whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => openTempPasswordDialog(user)}
                          className="inline-flex items-center rounded-full bg-emerald-600/90 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                        >
                          Set temp password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {tempPasswordUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-sm rounded-xl bg-slate-950 border border-slate-700 shadow-xl p-5">
              <h2 className="text-base font-semibold text-white mb-1">
                Set temporary password
              </h2>
              <p className="text-xs text-slate-300 mb-3">
                User: <span className="font-medium">{tempPasswordUser.name}</span>{' '}
                <span className="text-slate-400">({tempPasswordUser.email})</span>
              </p>

              <form onSubmit={handleSetTempPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    Temporary password
                  </label>
                  <input
                    type="text"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    minLength={6}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                    placeholder="At least 6 characters"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTempPasswordUser(null)
                      setTempPassword('')
                    }}
                    className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTemp}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {savingTemp ? 'Saving...' : 'Save temp password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

