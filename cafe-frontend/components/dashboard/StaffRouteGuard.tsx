'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export default function StaffRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    if (role !== 'STAFF') return
    const isAllowed =
      pathname === '/orders' ||
      pathname?.startsWith('/orders/') ||
      pathname === '/profile' ||
      pathname === '/set-password' ||
      pathname === '/settings' ||
      pathname === '/login'
    if (!isAllowed && pathname) {
      router.replace('/orders')
    }
  }, [pathname, router])

  return <>{children}</>
}
