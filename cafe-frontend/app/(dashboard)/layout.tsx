'use client'

import { useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import BottomNav from '@/components/dashboard/BottomNav'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import StaffRouteGuard from '@/components/dashboard/StaffRouteGuard'
import SyncProvider from '@/components/providers/SyncProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <StaffRouteGuard>
    <SyncProvider>
    <div className="flex flex-col min-h-dvh bg-slate-100">
      <DashboardHeader
        onMenuClick={() => setSidebarOpen((o) => !o)}
        isSidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 w-0 min-w-0 p-3 sm:p-4 lg:pl-6 overflow-y-auto overflow-x-hidden lg:ml-0 pb-[max(5rem,calc(5rem+env(safe-area-inset-bottom)))] lg:pb-6">
          <div className="container-content">
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
    </SyncProvider>
    </StaffRouteGuard>
  )
}
