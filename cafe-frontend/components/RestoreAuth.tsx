'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getAuthSync } from '@/lib/auth-storage'

/**
 * Redirects logged-in users from landing page to dashboard.
 */
export default function RestoreAuth() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const auth = getAuthSync()
    if (!auth) return
    if (pathname === '/') {
      const role = auth.role
      if (role === 'STAFF') {
        router.replace('/orders')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [router, pathname])
  return null
}
