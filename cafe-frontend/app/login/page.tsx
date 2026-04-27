'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authApi, ApiError } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'
import { saveAuth, getAuthSync, restoreAuth } from '@/lib/auth-storage'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // If already logged in (or session can be restored), skip the login screen.
  useEffect(() => {
    let cancelled = false

    const redirectIfAuthenticated = async () => {
      if (typeof window === 'undefined') return

      const existing = getAuthSync()
      if (existing?.token) {
        const role = existing.role
        if (role === 'STAFF') {
          router.replace('/orders')
        } else {
          router.replace('/dashboard')
        }
        return
      }

      const restored = await restoreAuth()
      if (cancelled || !restored) return

      const auth = getAuthSync()
      const role = auth?.role
      if (role === 'STAFF') {
        router.replace('/orders')
      } else {
        router.replace('/dashboard')
      }
    }

    void redirectIfAuthenticated()

    return () => {
      cancelled = true
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return // prevent double-submit race

    setLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const response = await authApi.login(normalizedEmail, password)
      saveAuth(response.access_token, response.tenantId, JSON.stringify(response.user), {
        role: response.role,
        branchId: response.branchId ?? null,
        mustChangePassword: response.mustChangePassword ?? false,
      })
      showToast('Login successful!', 'success')
      if (response.mustChangePassword) {
        router.push('/set-password')
        return
      }
      router.push('/profile')
    } catch (error: any) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          // Covers both invalid credentials and inactive account (backend message is specific).
          showToast(error.message || 'Invalid credentials', 'error')
        } else if (error.status >= 500) {
          showToast('Server error. Please try again later.', 'error')
        } else {
          showToast(error.message || 'Login failed', 'error')
        }
      } else {
        showToast('Login failed. Please check your connection and try again.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh sm:min-h-screen bg-slate-100 flex items-center justify-center p-4 py-8 sm:py-4">
      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-2">Hello Café</h1>
        <p className="text-gray-600 mb-6">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent text-base"
            />
          </div>

          <div className="flex justify-end">
            <a
              href="/forgot-password"
              className="text-sm text-red-700 hover:underline"
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-red-700 text-white py-2.5 rounded-lg font-medium hover:bg-red-800 active:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <a href="/register" className="text-red-700 hover:underline">
            Register
          </a>
        </p>
      </div>
    </div>
  )
}
