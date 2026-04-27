'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PendingPaymentsPage from '@/app/(dashboard)/billing/pending/page'

/**
 * Admin entry page.
 * Requirement: appUrl/admin should open the Admin "Pending Payments" screen.
 */
export default function AdminPage() {
  const router = useRouter()

  useEffect(() => {
    // Basic client-side guard for better UX.
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token || role !== 'ADMIN') {
      router.replace('/admin/login')
    }
  }, [router])

  return <PendingPaymentsPage />
}

