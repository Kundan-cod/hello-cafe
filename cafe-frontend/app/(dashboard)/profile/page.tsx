'use client'

import { useState, useEffect, useMemo } from 'react'
import { appAlert } from '@/components/ui/AppDialog'
import { tenantApi, authApi } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'
import { saveAuth } from '@/lib/auth-storage'

type ProfileData = {
  name: string
  email: string
  contactNumber?: string | null
  panNumber?: string | null
}

export default function ProfilePage() {
  const user = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  const userData = user ? JSON.parse(user) : null
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
  const isOwner = role === 'OWNER'

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [panNumber, setPanNumber] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [subscription, setSubscription] = useState<{
    planType: 'TRIAL' | 'PAID' | null
    currentSubscriptionEnd: string | null
  } | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      setLoadingProfile(true)
      try {
        const data = await authApi.getProfile()
        if (cancelled) return
        setProfile(data)
        setName(data?.name ?? '')
        setContactNumber(data?.contactNumber ?? '')
        setPanNumber(data?.panNumber ?? '')
      } catch {
        if (!cancelled) setProfile(null)
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }
    void loadProfile()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadSubscription() {
      setLoadingSubscription(true)
      try {
        const data = await tenantApi.getMe()
        if (cancelled) return
        setSubscription({
          planType: (data?.planType as 'TRIAL' | 'PAID' | null) ?? null,
          currentSubscriptionEnd: data?.currentSubscriptionEnd ?? null,
        })
      } catch {
        if (!cancelled) {
          setSubscription(null)
        }
      } finally {
        if (!cancelled) setLoadingSubscription(false)
      }
    }
    void loadSubscription()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword && newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }
    if (newPassword && !currentPassword) {
      showToast('Current password is required to change password', 'error')
      return
    }

    const hasProfileChanges = isOwner && (
      name !== (profile?.name ?? '') ||
      contactNumber !== (profile?.contactNumber ?? '') ||
      panNumber !== (profile?.panNumber ?? '')
    )
    const hasPasswordChange = !!newPassword

    if (!hasProfileChanges && !hasPasswordChange) {
      showToast('No changes to save', 'info')
      return
    }

    setSaving(true)
    try {
      const payload: {
        currentPassword?: string
        newPassword?: string
        panNumber?: string
        contactNumber?: string
        name?: string
      } = {}
      if (hasPasswordChange) {
        payload.currentPassword = currentPassword
        payload.newPassword = newPassword
      }
      if (isOwner && hasProfileChanges) {
        payload.name = name
        payload.contactNumber = contactNumber || undefined
        payload.panNumber = panNumber || undefined
      }
      const updated = await authApi.updateProfile(payload)
      setProfile(updated)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      if (updated?.name && updated.name !== userData?.name) {
        const token = localStorage.getItem('token')
        const tenantId = localStorage.getItem('tenantId')
        const roleStore = localStorage.getItem('role')
        const branchId = localStorage.getItem('branchId')
        saveAuth(token!, tenantId!, JSON.stringify({ name: updated.name, email: updated.email }), {
          role: roleStore ?? undefined,
          branchId: branchId ? branchId : null,
        })
      }
      showToast('Profile updated successfully', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const formattedEndDate = useMemo(() => {
    if (!subscription?.currentSubscriptionEnd) return null
    try {
      return new Date(subscription.currentSubscriptionEnd).toLocaleString()
    } catch {
      return subscription.currentSubscriptionEnd
    }
  }, [subscription])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Show manual install instructions
      await appAlert({
        title: 'Install app',
        message:
          'To install this app:\n\n' +
          'iOS (Safari):\n' +
          '1. Tap the Share button\n' +
          '2. Tap "Add to Home Screen"\n\n' +
          'Android (Chrome):\n' +
          '1. Tap the menu (3 dots)\n' +
          '2. Tap "Install app" or "Add to Home Screen"',
        confirmText: 'OK',
      })
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
      setIsInstallable(false)
    }

    setDeferredPrompt(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
      
      {/* Install App Section */}
      <div className="bg-white rounded-xl p-6 shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Install App</h2>
        {isInstalled ? (
          <div className="flex items-center gap-2 text-green-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="text-sm">App is installed</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Install Hello Café as an app for quick access.
            </p>
            <button
              onClick={handleInstall}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              {isInstallable ? 'Install App' : 'Show Install Instructions'}
            </button>
          </div>
        )}
      </div>

      {/* Personal Info - editable */}
      <div className="bg-white rounded-xl p-6 shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Info</h2>
        {loadingProfile ? (
          <p className="text-sm text-gray-500">Loading profile...</p>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-gray-900 py-1">{profile?.email || userData?.email || 'N/A'}</p>
              <p className="text-xs text-gray-500">Email cannot be changed</p>
            </div>

            {isOwner && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. 98xxxxxxxx"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    placeholder="e.g. 1234567890"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Change Password</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Required to change password"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-red-700 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-xl p-6 shadow">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Subscription</h2>
          {loadingSubscription ? (
            <p className="text-sm text-gray-500">Loading subscription details...</p>
          ) : subscription?.planType ? (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Plan:</span>
                <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  {subscription.planType === 'TRIAL' ? 'Free trial' : 'Paid'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Access valid until:</span>{' '}
                <span className="font-medium text-gray-900">
                  {formattedEndDate ?? 'Not available'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Subscription information is not available. If you just registered, try
              refreshing this page after a moment.
            </p>
          )}
      </div>
    </div>
  )
}
