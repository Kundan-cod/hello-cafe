'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { startBackgroundSync, stopBackgroundSync } from '@/lib/sync-engine'
import { getAuthSync } from '@/lib/auth-storage'

type SyncContextValue = {
  isOnline: boolean
}

const SyncContext = createContext<SyncContextValue>({ isOnline: true })

export function useSyncStatus() {
  return useContext(SyncContext)
}

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const auth = getAuthSync()
    if (!auth) return

    startBackgroundSync()

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      stopBackgroundSync()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <SyncContext.Provider value={{ isOnline }}>
      {children}
    </SyncContext.Provider>
  )
}
