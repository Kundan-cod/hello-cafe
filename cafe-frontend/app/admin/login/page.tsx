'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { saveAuth } from '@/lib/auth-storage'
import { ApiError } from '@/lib/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('Please enter admin ID and password.')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.adminLogin(username.trim(), password)
      // Reuse the same auth storage helper so JWT & role = ADMIN are available app-wide.
      saveAuth(
        res.access_token,
        res.tenantId ?? '',
        res.user?.email ?? username.trim(),
        { role: res.role, branchId: res.branchId, mustChangePassword: res.mustChangePassword }
      )
      router.replace('/admin')
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Admin login failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-slate-950/70 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm p-6 sm:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-emerald-300/80">
            Hello Café · Admin
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
            Admin console sign in
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Use the admin ID and password configured on the server. This area is for
            internal staff only.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/80 bg-red-500/10 px-3 py-2.5 text-sm text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-slate-100 mb-1.5"
            >
              Admin ID
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full rounded-lg border border-slate-500/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. admin@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-100 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-slate-500/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Enter admin password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
          >
            {loading ? 'Signing in...' : 'Sign in as Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}

