'use client'

import { useState, useEffect, useCallback } from 'react'
import { ordersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import Loading from '@/components/ui/Loading'
import Link from 'next/link'
import { db } from '@/lib/db'

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

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL')

  const loadOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else {
      // Show cached orders instantly while fetching fresh from server
      try {
        const cached = await db.orders.toArray()
        if (cached.length > 0) {
          setOrders(cached)
          setLoading(false)
        }
      } catch {}
      if (orders.length === 0) setLoading(true)
    }
    try {
      const data = await ordersApi.getOrders()
      const ordersList = Array.isArray(data) ? data : (data as { data?: any[] })?.data ?? []
      setOrders(ordersList)
      try { await db.orders.bulkPut(ordersList) } catch {}
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const now = new Date()
  const periodShort =
    period === 'today' ? 'Today' : period === '7days' ? '7 Days' : '1 Month'

  const filteredOrders = orders.filter((order: any) => {
    const created = new Date(order.createdAt).getTime()
    if (order.status !== 'COMPLETED') return false
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
  }).filter((order: any) => {
    if (paymentFilter === 'CASH') {
      return order.paymentMode === 'CASH'
    }
    if (paymentFilter === 'CARD_QR') {
      return order.paymentMode === 'CARD' || order.paymentMode === 'QR'
    }
    return true
  })

  const totalSales = filteredOrders.reduce((sum: number, o: any) => sum + (o.totalAmount ?? 0), 0)
  const cashOrders = filteredOrders.filter((o: any) => o.paymentMode === 'CASH')
  const settledCredit = filteredOrders.filter(
    (o: any) => o.paymentMode === 'CARD' || o.paymentMode === 'QR'
  )
  const settledCreditAmount = settledCredit.reduce(
    (sum: number, o: any) => sum + (o.totalAmount ?? 0),
    0
  )
  const cashPayment = cashOrders.reduce((sum: number, o: any) => sum + (o.totalAmount ?? 0), 0)
  const avgSalesOrder =
    filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0

  if (loading) return <Loading />

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Dashboard
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => loadOrders(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link
            href="/orders/new"
            className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 active:bg-red-800 w-full sm:w-auto"
            prefetch
          >
            + New Order
          </Link>
        </div>
      </div>

      {/* Period filter */}
      <p className="text-sm text-gray-600 mb-2">Sales period</p>
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-1 -mx-1 px-1">
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
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {getPeriodLabel(period)} · Completed orders only
      </p>

      {/* Simple filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
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

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Total Sales"
          value={formatCurrency(totalSales)}
          subtext={`${periodShort} (${filteredOrders.length} orders)`}
          icon="banknotes"
        />
        <MetricCard
          title="Settled (Card/QR)"
          value={formatCurrency(settledCreditAmount)}
          subtext={`${periodShort}`}
          icon="credit"
        />
        <MetricCard
          title="Cash Payment"
          value={formatCurrency(cashPayment)}
          subtext={`${periodShort}`}
          icon="cash"
        />
        <MetricCard
          title="Avg per Order"
          value={formatCurrency(avgSalesOrder)}
          subtext={filteredOrders.length ? `${periodShort}` : '—'}
          icon="store"
        />
      </div>

      {filteredOrders.length === 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            No completed orders in this period
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Create an order and complete it to see sales here.
          </p>
          <Link
            href="/orders/new"
            className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-amber-400"
            prefetch
          >
            New Order
          </Link>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
        <Link
          href="/orders"
          className="rounded-xl bg-white p-4 sm:p-5 text-gray-900 shadow border border-gray-200 hover:bg-gray-50 transition min-h-[80px] flex flex-col justify-center"
          prefetch
        >
          <h2 className="font-semibold mb-1 text-base sm:text-lg">View All Orders</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage and track all your orders</p>
        </Link>
        <Link
          href="/menu"
          className="rounded-xl bg-white p-4 sm:p-5 text-gray-900 shadow border border-gray-200 hover:bg-gray-50 transition min-h-[80px] flex flex-col justify-center"
          prefetch
        >
          <h2 className="font-semibold mb-1 text-base sm:text-lg">Manage Menu</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add categories and menu items</p>
        </Link>
        <Link
          href="/customers"
          className="rounded-xl bg-white p-4 sm:p-5 text-gray-900 shadow border border-gray-200 hover:bg-gray-50 transition min-h-[80px] flex flex-col justify-center"
          prefetch
        >
          <h2 className="font-semibold mb-1 text-base sm:text-lg">Customers & Creditors</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage customers and track credit balances</p>
        </Link>
        <Link
          href="/discounts"
          className="rounded-xl bg-white p-4 sm:p-5 text-gray-900 shadow border border-gray-200 hover:bg-gray-50 transition min-h-[80px] flex flex-col justify-center"
          prefetch
        >
          <h2 className="font-semibold mb-1 text-base sm:text-lg">Discount & Offers</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create offer codes and apply at billing</p>
        </Link>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtext,
  icon,
}: {
  title: string
  value: string
  subtext: string
  icon: 'banknotes' | 'credit' | 'cash' | 'store'
}) {
  const iconClass = 'w-7 h-7 sm:w-8 sm:h-8 text-amber-600 shrink-0'
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-white p-4 shadow border border-gray-200">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1 break-words">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{subtext}</p>
      </div>
      <div className="shrink-0 ml-3">
        {icon === 'banknotes' && (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 8h20M4 6v12a2 2 0 002 2h12a2 2 0 002-2V6M4 6a2 2 0 012-2h2a2 2 0 012 2m0 0v12m0-6v-6" />
          </svg>
        )}
        {icon === 'credit' && (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        )}
        {icon === 'cash' && (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        )}
        {icon === 'store' && (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        )}
      </div>
    </div>
  )
}
