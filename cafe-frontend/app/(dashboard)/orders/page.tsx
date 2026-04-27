'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ordersApi } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'
import Loading from '@/components/ui/Loading'
import { formatCurrency } from '@/lib/utils'
import { db } from '@/lib/db'

interface Order {
  id: string
  orderNumber: number
  totalAmount: number
  paymentMode?: string
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  status?: string
  note?: string | null
  customerName?: string | null
  customerPhone?: string | null
  deliveryAddress?: string | null
  counterNumber?: string | null
  table?: {
    id: string
    code: string
    area?: { id: string; name: string } | null
  } | null
  createdAt: string
  items: Array<{
    id: string
    quantity: number
    price: number
    status?: string
    menuItem: { name: string }
  }>
}

type OrderStatus = 'IN_PROCESS' | 'COMPLETED' | 'CREDIT' | 'CANCELLED'

type OrderWithUiStatus = Order & { uiStatus: OrderStatus }

const PAGE_SIZE = 25

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderWithUiStatus[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('IN_PROCESS')
  const [searchQuery, setSearchQuery] = useState('')
  const [deliveryFilter, setDeliveryFilter] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const loadOrdersRef = useRef<(silent: boolean, append: boolean) => void>(() => {})

  useEffect(() => {
    setNextCursor(null)
    loadOrders(false, false)
  }, [selectedStatus, deliveryFilter, searchQuery])

  // Refetch when page becomes visible (tab switch) or restored from bfcache (back button)
  // so changes from create/update/complete are shown without manual refresh
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadOrdersRef.current(true, false)
      }
    }
    // In Chrome, pageshow.persisted is almost always false, so rely on the event
    // itself to know when we are being shown again (e.g. browser back from billing).
    // Use a silent refresh so we don't flash the global loading spinner.
    const onPageShow = () => {
      loadOrdersRef.current(true, false)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  // Lightweight polling while user is on the Orders page,
  // so new/updated orders appear without tab change or manual refresh.
  useEffect(() => {
    // Poll more frequently only for in-process view where real-time changes matter most.
    if (selectedStatus !== 'IN_PROCESS') return

    const INTERVAL_MS = 3000 // 10 seconds
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadOrdersRef.current(true, false)
      }
    }, INTERVAL_MS)

    return () => clearInterval(id)
  }, [selectedStatus, deliveryFilter, searchQuery])

  // Debounce search input and reset cursor when search changes
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput)
      setNextCursor(null)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadOrders = async (silent: boolean = false, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else if (!silent) {
        // Show cached orders instantly while server fetch happens
        try {
          const cached = await db.orders.toArray()
          if (cached.length > 0 && orders.length === 0) {
            const mapped: OrderWithUiStatus[] = cached.map((order: any) => {
              let uiStatus: OrderStatus
              switch (order.status) {
                case 'COMPLETED': uiStatus = 'COMPLETED'; break
                case 'CANCELLED': uiStatus = 'CANCELLED'; break
                case 'CREDIT': uiStatus = 'CREDIT'; break
                default: uiStatus = 'IN_PROCESS'
              }
              return { ...order, uiStatus }
            })
            const filtered = mapped.filter(o => o.uiStatus === selectedStatus)
            if (filtered.length > 0) {
              setOrders(filtered)
              setLoading(false)
            }
          }
        } catch {}
        if (orders.length === 0) setLoading(true)
      }
      const branchId = typeof window !== 'undefined' ? localStorage.getItem('branchId') : null
      const result = await ordersApi.getOrders(branchId, {
        cursor: append ? nextCursor ?? undefined : undefined,
        limit: PAGE_SIZE,
        status: selectedStatus,
        orderType: deliveryFilter ? 'DELIVERY' : undefined,
        search: searchQuery.trim() || undefined,
      })
      const isCursorPaginated = result && typeof result === 'object' && 'data' in result && 'nextCursor' in result
      const ordersList = isCursorPaginated
        ? (result as { data: any[] }).data
        : Array.isArray(result) ? result : []
      const newNextCursor = isCursorPaginated ? (result as { nextCursor: string | null }).nextCursor : null

      // Map backend status to UI buckets without mutating original status
      const ordersWithStatus: OrderWithUiStatus[] = ordersList.map((order: any) => {
        let uiStatus: OrderStatus
        switch (order.status) {
          case 'COMPLETED':
            uiStatus = 'COMPLETED'
            break
          case 'CANCELLED':
            uiStatus = 'CANCELLED'
            break
          case 'CREDIT':
            uiStatus = 'CREDIT'
            break
          case 'PENDING':
          case 'PREPARING':
          case 'READY':
            uiStatus = 'IN_PROCESS'
            break
          // Anything else => treat as in-process but log for visibility
          default:
            console.warn(
              'Unknown order.status received, defaulting uiStatus to IN_PROCESS',
              order.status
            )
            uiStatus = 'IN_PROCESS'
        }
        return { ...order, uiStatus }
      })
      // Cache fetched orders to IndexedDB for instant load next time
      try {
        await db.orders.bulkPut(ordersList)
      } catch {}

      if (append) {
        setOrders((prev) => [...prev, ...ordersWithStatus])
        setNextCursor(newNextCursor)
      } else if (silent && nextCursor != null) {
        // Silent refresh while user has loaded more: merge first page only, keep rest and nextCursor
        const firstPageIds = new Set(ordersWithStatus.map((o) => o.id))
        setOrders((prev) => {
          const merged = new Map(ordersWithStatus.map((o) => [o.id, o]))
          prev.forEach((o) => {
            if (!firstPageIds.has(o.id)) merged.set(o.id, o)
          })
          return [...merged.values()].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        })
        // Keep existing nextCursor so "Load more" doesn't re-fetch the same page
      } else {
        setOrders(ordersWithStatus)
        setNextCursor(newNextCursor)
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load orders', 'error')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }
  loadOrdersRef.current = loadOrders

  // Backend already applies status, delivery, search filters
  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    return sorted
  }, [orders])

  const getStatusBadge = (order: OrderWithUiStatus) => {
    // For in-process orders, compute serve state from item statuses
    if (order.uiStatus === 'IN_PROCESS') {
      const { totalItems, servedCount } = order.items.reduce(
        (acc, item) => {
          const quantity = item?.quantity ?? 0
          acc.totalItems += quantity
          if (item.status === 'SERVED') {
            acc.servedCount += quantity
          }
          return acc
        },
        { totalItems: 0, servedCount: 0 }
      )

      if (servedCount === 0 || totalItems === 0) {
        return { label: 'Unserved', color: 'bg-red-100 text-red-800' }
      }
      if (servedCount === totalItems) {
        return { label: 'Served', color: 'bg-green-100 text-green-800' }
      }
      return { label: 'Partially Served', color: 'bg-yellow-100 text-yellow-800' }
    }

    // For other buckets, fall back to UI status bucket
    switch (order.uiStatus) {
      case 'COMPLETED':
        return { label: 'Completed', color: 'bg-green-100 text-green-800' }
      case 'CREDIT':
        return { label: 'Credit', color: 'bg-yellow-100 text-yellow-800' }
      case 'CANCELLED':
        return { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' }
      default:
        return { label: 'In-Process', color: 'bg-blue-100 text-blue-800' }
    }
  }

  const formatOrderDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'long' })
    const year = date.getFullYear()
    return `${day} ${month}, ${year}`
  }

  const formatOrderTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getTotalItems = (order: OrderWithUiStatus) => {
    return order.items.reduce((sum, item) => sum + item.quantity, 0)
  }

  // Group orders by date (must be before conditional return)
  const ordersByDate = useMemo(() => {
    const grouped: Record<string, OrderWithUiStatus[]> = {}
    filteredOrders.forEach((order) => {
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(order)
    })
    return grouped
  }, [filteredOrders])

  if (loading && orders.length === 0) {
    return <Loading />
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header - scrolls with the list */}
      <div className="bg-white border-b">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">Order List</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => router.push('/orders/new')}
              className="hidden sm:inline-flex items-center justify-center min-h-[44px] gap-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 active:bg-red-900"
            >
              <span>+ New Order</span>
            </button>
            <button
              onClick={() => router.push('/orders/new')}
              className="sm:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full bg-red-700 text-white hover:bg-red-800 active:bg-red-900"
              aria-label="New order"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm text-gray-700 font-medium">Delivery</span>
              <button
                onClick={() => setDeliveryFilter(!deliveryFilter)}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  deliveryFilter ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                aria-label={deliveryFilter ? 'Filter by delivery on' : 'Filter by delivery off'}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                    deliveryFilter ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 sm:px-4 pb-3">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search orders, table, items..."
              className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-base"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Status Filters - horizontal scroll on small screens */}
        <div className="px-3 sm:px-4 pb-3 flex gap-2 overflow-x-auto">
          {(['IN_PROCESS', 'COMPLETED', 'CREDIT', 'CANCELLED'] as OrderStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`shrink-0 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                selectedStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              {status === 'IN_PROCESS'
                ? 'In-Process'
                : status === 'COMPLETED'
                  ? 'Completed'
                  : status === 'CREDIT'
                    ? 'Credit'
                    : 'Cancelled'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="p-3 sm:p-4 space-y-4">
        {Object.keys(ordersByDate).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-gray-500">
            <p>No orders found</p>
            {orders.length === 0 ? (
              <button
                onClick={() => router.push('/orders/new')}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
              >
                + Create your first order
              </button>
            ) : null}
          </div>
        ) : (
          Object.entries(ordersByDate)
            .sort(([aKey], [bKey]) => (aKey < bKey ? 1 : aKey > bKey ? -1 : 0))
            .map(([dateKey, dateOrders]) => (
            <div key={dateKey}>
              <p className="text-sm font-medium text-red-600 text-center mb-3">
                {formatOrderDate(dateKey)}
              </p>
              <div className="space-y-3">
                {dateOrders.map((order) => {
                  const statusBadge = getStatusBadge(order)
                  const totalItems = getTotalItems(order)
                  return (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}/billing`}
                      prefetch
                      className="block bg-white rounded-lg p-4 shadow-sm border border-gray-200 transition-colors cursor-pointer active:bg-gray-50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">
                              {order.orderType === 'DELIVERY' && order.customerName
                                ? `Delivery: ${order.customerName}`
                                : order.counterNumber != null
                                  ? `Counter #${order.counterNumber}`
                                  : order.table?.code && order.table?.area?.name
                                    ? `${order.table.code} - ${order.table.area.name}`
                                    : order.table?.code || (order.orderType === 'TAKEAWAY' ? 'Takeaway' : 'No Table')}
                            </p>
                            {order.orderType === 'DELIVERY' && order.paymentMode && (
                              <span className="text-xs text-gray-500">
                                ({order.paymentMode === 'CASH' ? 'Cash On Delivery' : order.paymentMode === 'CARD' ? 'Prepaid' : order.paymentMode})
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${statusBadge.color}`}
                            >
                              {statusBadge.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">
                            No. of items: {totalItems}
                            {order.note && (
                              <span className="text-amber-700 ml-1"> • Note: {order.note.length > 30 ? `${order.note.slice(0, 30)}...` : order.note}</span>
                            )}
                          </p>
                          <p className="text-sm font-bold text-red-600">
                            Rs. {order.totalAmount.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-start gap-2">
                          <p className="text-xs text-gray-600 sm:mb-1">
                            {formatOrderTime(order.createdAt)}
                          </p>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (order.uiStatus !== 'IN_PROCESS') return
                              router.push(`/orders/${order.id}/edit`)
                            }}
                            disabled={order.uiStatus !== 'IN_PROCESS'}
                            className={`min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium shrink-0 ${
                              order.uiStatus === 'IN_PROCESS'
                                ? 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            Edit Items
                          </button>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* Cursor pagination: Load more */}
        {filteredOrders.length > 0 && nextCursor != null && (
          <div className="flex justify-center pt-4 pb-2">
            <button
              onClick={() => loadOrders(true, true)}
              disabled={loadingMore}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
