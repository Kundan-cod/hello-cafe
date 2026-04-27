'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'
import { saveAuth } from '@/lib/auth-storage'

export default function SetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }
    setLoading(true)
    try {
      const response = await authApi.setPassword(newPassword)
      saveAuth(response.access_token, response.tenantId, JSON.stringify(response.user), {
        role: response.role,
        branchId: response.branchId ?? null,
        mustChangePassword: false,
      })
      showToast('Password set successfully!', 'success')
      router.push('/dashboard')
    } catch (error: any) {
      showToast(error.message || 'Failed to set password', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Set New Password</h1>
      <p className="text-gray-600 mb-6">
        You are logging in for the first time. Please set a new password for your account.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] bg-red-700 text-white py-2.5 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
        >
          {loading ? 'Setting password...' : 'Set Password'}
        </button>
      </form>
    </div>
  )
}
