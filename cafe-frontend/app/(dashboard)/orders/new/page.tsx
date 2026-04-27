'use client'

import { Suspense } from 'react'
import Loading from '@/components/ui/Loading'
import NewOrderPage from '@/components/orders/NewOrderPage'

export default function NewOrderRoute() {
  return (
    <Suspense fallback={<Loading />}>
      <NewOrderPage />
    </Suspense>
  )
}
