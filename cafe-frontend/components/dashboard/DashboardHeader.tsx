'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAuthSync, getAuth } from '@/lib/auth-storage'

interface DashboardHeaderProps {
  onMenuClick?: () => void
  isSidebarOpen?: boolean
}

export default function DashboardHeader({ onMenuClick, isSidebarOpen }: DashboardHeaderProps) {
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const loadUser = async () => {
      try {
        const auth = getAuthSync() || await getAuth()
        if (auth?.user) {
          const data = JSON.parse(auth.user)
          setUserName(data?.name ?? data?.email ?? 'Profile')
        } else {
          setUserName('Profile')
        }
      } catch {
        setUserName('Profile')
      }
    }
    loadUser()
  }, [])

  return (
    <header className="flex-shrink-0 h-14 min-h-[56px] pt-[env(safe-area-inset-top)] px-3 sm:px-4 lg:px-6 flex items-center justify-between bg-white border-b border-gray-200 z-30 sticky top-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Sidebar toggle - left of app icon, mobile/tablet only */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors -ml-1"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isSidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        )}
        <Link
          href="/dashboard"
          className="text-red-700 font-semibold text-lg truncate min-w-0"
          prefetch
        >
          Hello Café
        </Link>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-shrink-0">
        {/* Notification - 44px touch target */}
        <Link
          href="/notifications"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 transition-colors"
          aria-label="Notifications"
          prefetch
        >
          <svg
            className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </Link>

        {/* Profile - 44px min touch target */}
        <Link
          href="/profile"
          className="flex items-center gap-2 min-h-[44px] min-w-[44px] sm:min-w-0 pl-1 pr-2 sm:px-3 py-2 rounded-full text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          prefetch
        >
          <span className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {userName && userName !== 'Profile' ? userName.charAt(0).toUpperCase() : '?'}
          </span>
          <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]">
            {userName ?? 'Profile'}
          </span>
        </Link>
      </div>
    </header>
  )
}
