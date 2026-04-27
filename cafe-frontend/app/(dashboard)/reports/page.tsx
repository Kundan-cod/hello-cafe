'use client'

import { useState, useEffect, useCallback } from 'react'
import { branchesApi, ordersApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import Loading from '@/components/ui/Loading'
import Link from 'next/link'

type Branch = { id: string; name: string; location: string | null }
type Period = 'today' | '7days' | 'month'
type PaymentFilter = 'ALL' | 'CASH' | 'CARD_QR'

function getPeriodLabel(period: Period): string {
  const now = new Date()
  if (period === 'today') {
    return `Today (${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`
  }
  if (period === '7days') return 'Last 7 days'
  return 'This month'
}

function filterOrdersByPeriod(orders: any[], period: Period): any[] {
  const now = new Date()
  return orders.filter((order) => {
    const created = new Date(order.createdAt).getTime()
    if (period === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      return created >= start
    }
    if (period === '7days') {
      const start = now.getTime() - 7 * 24 * 60 * 60 * 1000
      return created >= start
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return created >= start
  })
}

export default function ReportsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('today')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL')

  useEffect(() => {
    setRole(typeof window !== 'undefined' ? localStorage.getItem('role') : null)
  }, [])

  useEffect(() => {
    if (role === 'OWNER') {
      branchesApi
        .getBranches()
        .then((data: Branch[]) => setBranches(data))
        .catch(() => {})
    }
  }, [role])

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const branchId =
          selectedBranchId != null && selectedBranchId !== '' ? selectedBranchId : undefined
        const data = await ordersApi.getOrders(branchId)
        const ordersList = Array.isArray(data) ? data : (data as { data?: any[] })?.data ?? []
        setOrders(ordersList)
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [selectedBranchId]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  const periodOrders = filterOrdersByPeriod(orders, period).filter((order) => {
    if (paymentFilter === 'CASH') {
      return order.paymentMode === 'CASH'
    }
    if (paymentFilter === 'CARD_QR') {
      return order.paymentMode === 'CARD' || order.paymentMode === 'QR'
    }
    return true
  })
  const totalRevenue = periodOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0)
  const totalOrdersCount = periodOrders.length
  const cashRevenue = periodOrders
    .filter((o) => o.paymentMode === 'CASH')
    .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0)
  const cardQrRevenue = periodOrders
    .filter((o) => o.paymentMode === 'CARD' || o.paymentMode === 'QR')
    .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0)
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0
  const recentOrders = orders.slice(0, 15)
  const periodShort = period === 'today' ? 'Today' : period === '7days' ? '7 Days' : '1 Month'

  // Aggregate top-selling items within the selected period
  const itemStatsMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >()

  periodOrders.forEach((order) => {
    if (!Array.isArray(order.items)) return
    order.items.forEach((item: any) => {
      const key =
        item.menuItem?.id ?? item.menuItemId ?? item.id ?? String(item.name ?? 'unknown')
      const name = item.menuItem?.name ?? item.name ?? 'Unknown item'
      const qty = item.quantity ?? 0
      const revenue = (item.price ?? 0) * qty

      const existing = itemStatsMap.get(key)
      if (existing) {
        existing.quantity += qty
        existing.revenue += revenue
      } else {
        itemStatsMap.set(key, { name, quantity: qty, revenue })
      }
    })
  })

  const topItems = Array.from(itemStatsMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  if (loading) return <Loading />

  return (
    <div className="min-h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Reports & Analytics
        </h1>
        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {role === 'OWNER' && branches.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Branch
          </label>
          <select
            value={selectedBranchId ?? ''}
            onChange={(e) =>
              setSelectedBranchId(e.target.value === '' ? null : e.target.value)
            }
            className="w-full max-w-xs px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-sm text-gray-600 mb-2">Report period</p>
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
        {(
          [
            { key: 'today' as Period, label: 'Today' },
            { key: '7days' as Period, label: '7 Days' },
            { key: 'month' as Period, label: '1 Month' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`shrink-0 min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-medium transition border ${
              period === key
                ? 'bg-amber-400 text-gray-900 border-amber-500 shadow-sm'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {getPeriodLabel(period)}
      </p>

      {/* Simple filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-sm font-medium text-gray-700">Filter</span>
        <select
          className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
        >
          <option value="ALL">All payments</option>
          <option value="CASH">Cash only</option>
          <option value="CARD_QR">Card & QR only</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="rounded-xl bg-white p-4 shadow border border-gray-200">
          <p className="text-sm font-medium text-gray-600">Total Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {periodShort} · {totalOrdersCount} orders
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow border border-gray-200">
          <p className="text-sm font-medium text-gray-600">Total Orders</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {totalOrdersCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">{periodShort}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow border border-gray-200">
          <p className="text-sm font-medium text-gray-600">Cash</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(cashRevenue)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Card/QR: {formatCurrency(cardQrRevenue)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow border border-gray-200">
          <p className="text-sm font-medium text-gray-600">Avg per Order</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(avgOrderValue)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{periodShort}</p>
        </div>
      </div>

      {/* Top selling items in this period */}
      <div className="rounded-xl bg-white p-4 sm:p-6 shadow border border-gray-200 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Top selling items ({periodShort})
        </h2>
        {topItems.length === 0 ? (
          <p className="text-sm text-gray-500">No item sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 pr-4 text-sm font-semibold text-gray-700">Item</th>
                  <th className="pb-2 pr-4 text-sm font-semibold text-gray-700 text-right">
                    Qty sold
                  </th>
                  <th className="pb-2 text-sm font-semibold text-gray-700 text-right">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item) => (
                  <tr key={item.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 pr-4 text-sm text-gray-900">{item.name}</td>
                    <td className="py-3 pr-4 text-sm text-gray-700 text-right">
                      {item.quantity}
                    </td>
                    <td className="py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-4 sm:p-6 shadow border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Recent Orders (all time)
        </h2>
        {recentOrders.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500">No orders found</p>
            <Link
              href="/orders/new"
              className="mt-2 inline-block text-amber-600 font-medium hover:underline"
              prefetch
            >
              Create first order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 pr-4 text-sm font-semibold text-gray-700">
                    Order
                  </th>
                  <th className="pb-2 pr-4 text-sm font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="pb-2 text-sm font-semibold text-gray-700 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/orders/${order.id}/billing`}
                        className="font-medium text-gray-900 hover:text-amber-600"
                        prefetch
                      >
                        #{order.orderNumber ?? order.id}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-600">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(order.totalAmount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
