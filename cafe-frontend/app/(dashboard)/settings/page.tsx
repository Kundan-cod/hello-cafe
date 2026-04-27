'use client'

import { useState, useEffect } from 'react'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import { clearAuth } from '@/lib/auth-storage'
import { tenantApi } from '@/lib/api'
import { db } from '@/lib/db'

type OrderManagementType = 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH' | null

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [orderManagementType, setOrderManagementType] = useState<OrderManagementType>(null)
  const [loadingOrderType, setLoadingOrderType] = useState(true)
  const [savingOrderType, setSavingOrderType] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    if (userData) {
      const parsed = JSON.parse(userData) as { name?: string; email?: string }
      setUser({ ...parsed, role: role ?? undefined })
    }
  }, [])

  useEffect(() => {
    setLoadingOrderType(true)
    // Show cached tenant data instantly
    db.tenant.toCollection().first()
      .then((cached) => {
        if (cached?.orderManagementType) {
          setOrderManagementType(cached.orderManagementType)
          setLoadingOrderType(false)
        }
      })
      .catch(() => {})
    tenantApi
      .getMe(undefined)
      .then((data) => setOrderManagementType(data?.orderManagementType ?? null))
      .catch(() => {})
      .finally(() => setLoadingOrderType(false))
  }, [])

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Settings</h1>

      <div className="space-y-4 sm:space-y-6">
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4">Profile Information</h2>
          {user && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={user.name || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={user.role || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 text-base"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 shadow">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4">Cafe Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Management Type
              </label>
              <p className="text-gray-500 text-sm mb-2">
                How customers are identified for dine-in: by table, by counter number, or both.
              </p>
              {user?.role === 'OWNER' ? (
                <>
                  <select
                    value={loadingOrderType ? '' : (orderManagementType ?? '')}
                    onChange={(e) => setOrderManagementType((e.target.value || null) as OrderManagementType)}
                    disabled={loadingOrderType}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-wait"
                  >
                    {loadingOrderType ? (
                      <option value="">Loading...</option>
                    ) : (
                      <>
                        <option value="TABLE_BASED">Table Based</option>
                        <option value="COUNTER_BASED">Counter Based</option>
                        <option value="BOTH">Both</option>
                      </>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (orderManagementType == null) return
                      setSavingOrderType(true)
                      try {
                        await tenantApi.updateMe({ orderManagementType })
                        showToast('Cafe default order management type updated', 'success')
                      } catch (e: any) {
                        showToast(e?.message ?? 'Failed to update', 'error')
                      } finally {
                        setSavingOrderType(false)
                      }
                    }}
                    disabled={orderManagementType == null || savingOrderType}
                    className="mt-3 min-h-[44px] px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {savingOrderType ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <p className="text-gray-600">
                  {loadingOrderType
                    ? 'Loading...'
                    : `Set by cafe owner${orderManagementType != null ? ` (your branch uses: ${orderManagementType === 'TABLE_BASED' ? 'Table Based' : orderManagementType === 'COUNTER_BASED' ? 'Counter Based' : 'Both'}).` : '.'}`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 shadow">
          <h2 className="font-semibold mb-4 text-red-700">Danger Zone</h2>
          <button
            onClick={async () => {
              const ok = await appConfirm({
                title: 'Logout',
                message: 'Are you sure you want to logout?',
                confirmText: 'Logout',
                cancelText: 'Cancel',
                destructive: true,
              })
              if (!ok) return
              await clearAuth()
              window.location.href = '/login'
            }}
            className="min-h-[44px] px-4 py-2.5 bg-red-700 text-white rounded-lg hover:bg-red-800 active:bg-red-900 font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
