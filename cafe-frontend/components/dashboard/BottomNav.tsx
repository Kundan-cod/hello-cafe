'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function BottomNav() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    setRole(typeof window !== 'undefined' ? localStorage.getItem('role') : null)
  }, [pathname])

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname?.startsWith(path)
  }

  const isStaff = role === 'STAFF'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 pt-2 pb-1 gap-1">
        {!isStaff && (
          <>
            {/* Home */}
            <Link
              href="/dashboard"
              prefetch
              className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 ${
                isActive('/dashboard') ? 'text-red-700' : 'text-gray-600'
              }`}
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="text-xs font-medium">Home</span>
            </Link>
          </>
        )}

        {/* Orders */}
        <Link
          href="/orders"
          prefetch
          className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 ${
            isActive('/orders') ? 'text-red-700' : 'text-gray-600'
          }`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span className="text-xs font-medium">Orders</span>
        </Link>

        {/* Add Order Button - Centered - shown for all */}
        <Link
          href="/orders/new"
          prefetch
          className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-105 -mt-6"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </Link>

        {/* Billing */}
        {!isStaff && (
          <Link
            href="/billing"
            prefetch
            className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 ${
              isActive('/billing') ? 'text-red-700' : 'text-gray-600'
            }`}
          >
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.6 1M12 4v2m0 12v2m8-10a8 8 0 11-16 0 8 8 0 0116 0z"
              />
            </svg>
            <span className="text-xs font-medium">Billing</span>
          </Link>
        )}

        {/* Profile */}
        <Link
          href="/profile"
          prefetch
          className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 ${
            isActive('/profile') ? 'text-red-700' : 'text-gray-600'
          }`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="text-xs font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  )
}
