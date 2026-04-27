'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi, ApiError } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const normalizedEmail = email.trim().toLowerCase()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!normalizedEmail) {
      showToast('Please enter your email address', 'error')
      return
    }

    setLoading(true)
    try {
      await authApi.forgotPassword(normalizedEmail)
      showToast(
        'If this email is registered, the admin has been notified.',
        'success'
      )
      router.push('/login')
    } catch (error: any) {
      if (error instanceof ApiError) {
        showToast(error.message || 'Failed to submit request', 'error')
      } else {
        showToast(
          'Unable to submit request. Please check your connection and try again.',
          'error'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh sm:min-h-screen bg-slate-100 flex items-center justify-center p-4 py-8 sm:py-4">
      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-red-700 mb-2">
          Forgot Password
        </h1>
        <p className="text-gray-600 mb-6">
          Enter your email address and we will send your request to the admin,
          who will help you reset your password.
        </p>

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

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-red-700 text-white py-2.5 rounded-lg font-medium hover:bg-red-800 active:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending request...' : 'Send Request to Admin'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Remembered your password?{' '}
          <a href="/login" className="text-red-700 hover:underline">
            Back to login
          </a>
        </p>
      </div>
    </div>
  )
}

