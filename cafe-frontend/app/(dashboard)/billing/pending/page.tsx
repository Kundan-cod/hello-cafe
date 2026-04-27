'use client'

import { useEffect, useMemo, useState } from 'react'
import { billingApi, ApiError } from '@/lib/api'
import Modal from '@/components/ui/Modal'

type PendingSubscription = {
  id: string
  transactionId: string | null
  paidAmount: number | null
  createdAt: string
  tenant: {
    id: string
    cafeName: string
  }
  plan: {
    id: string
    name: string
    price: number
    durationDays: number
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export default function PendingPaymentsPage() {
  const [items, setItems] = useState<PendingSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await billingApi.getPendingSubscriptions()
      setItems(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to load pending subscriptions.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((item) => {
      return (
        item.tenant.cafeName.toLowerCase().includes(q) ||
        item.tenant.id.toLowerCase().includes(q) ||
        item.plan.name.toLowerCase().includes(q) ||
        (item.transactionId ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, search])

  const totalAmount = useMemo(
    () =>
      filteredItems.reduce(
        (sum, item) => sum + (item.paidAmount ?? item.plan.price ?? 0),
        0
      ),
    [filteredItems]
  )

  async function handleApprove(id: string) {
    setError(null)
    setActionMessage(null)
    try {
      await billingApi.approveSubscription(id)
      setActionMessage('Subscription approved successfully.')
      await load()
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to approve subscription.'
      setError(message)
    }
  }

  function openRejectModal(id: string) {
    setSelectedId(id)
    setRejectNote('')
  }

  async function confirmReject() {
    if (!selectedId) return
    if (!rejectNote.trim()) {
      setError('Rejection note is required.')
      return
    }

    setRejecting(true)
    setError(null)
    setActionMessage(null)
    try {
      await billingApi.rejectSubscription(selectedId, rejectNote.trim())
      setActionMessage('Subscription rejected.')
      setSelectedId(null)
      setRejectNote('')
      await load()
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to reject subscription.'
      setError(message)
    } finally {
      setRejecting(false)
    }
  }

  const visibleCount = filteredItems.length

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-900/95">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* Page header */}
        <header className="mb-6 sm:mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                Admin · Billing
              </p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
                Pending subscription payments
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
          <p className="max-w-2xl text-xs sm:text-sm text-slate-300">
            Review manual eSewa QR payments submitted by cafes. Approve to activate their
            subscription or reject with a clear note for your internal records.
          </p>
        </header>

        {/* Alerts */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-400/80 bg-red-500/10 px-3 py-2.5 text-sm text-red-100">
            {error}
          </div>
        )}
        {actionMessage && (
          <div className="mb-4 rounded-lg border border-emerald-400/80 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100">
            {actionMessage}
          </div>
        )}

        {/* Overview cards */}
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-400/40 bg-slate-900/60 p-4 shadow-lg">
            <p className="text-xs font-medium text-emerald-200">Pending payments</p>
            <p className="mt-1 text-3xl font-semibold text-white">{items.length}</p>
            <p className="mt-1 text-xs text-slate-300">Across all cafes</p>
          </div>
          <div className="rounded-xl border border-slate-500/40 bg-slate-900/60 p-4 shadow-lg">
            <p className="text-xs font-medium text-slate-200">Filtered amount</p>
            <p className="mt-1 text-3xl font-semibold text-white">
              Rs. {totalAmount.toLocaleString('en-NP')}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Based on {visibleCount} visible record{visibleCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent p-4 shadow-lg">
            <p className="text-xs font-medium text-emerald-50">Tip</p>
            <p className="mt-1 text-xs text-emerald-50/90">
              Always verify the eSewa transaction details before approving a payment. Use
              the rejection note to document why a payment was declined.
            </p>
          </div>
        </section>

        {/* Toolbar */}
        <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <span className="inline-flex h-5 items-center rounded-full bg-emerald-500/20 px-2 text-[11px] font-medium text-emerald-200">
              {visibleCount} result{visibleCount === 1 ? '' : 's'} visible
            </span>
            {loading && <span className="text-[11px] text-slate-300">Refreshing…</span>}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Search cafe, plan, or transaction ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-slate-500/60 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-72"
            />
            <button
              type="button"
              onClick={() => {
                setSearch('')
              }}
              className="hidden sm:inline-flex items-center rounded-full border border-slate-500/60 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-2xl border border-slate-600/60 bg-slate-950/70 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-semibold">
                Rs
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-100">
                  Pending payments table
                </h2>
                <p className="text-[11px] text-slate-300">
                  Each row is a manual subscription request awaiting review.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-slate-500/60 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800 sm:hidden"
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-slate-200">Loading pending payments...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-slate-200">
              There are currently no pending payments. New submissions will appear here
              instantly.
            </div>
          ) : visibleCount === 0 ? (
            <div className="p-6 text-sm text-slate-200">
              No records match your search. Try adjusting the filters or clearing the
              search box.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-slate-900/80 text-xs uppercase text-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Cafe</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Paid amount</th>
                    <th className="px-4 py-3 font-semibold">Transaction ID</th>
                    <th className="px-4 py-3 font-semibold">Submitted at</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                  {filteredItems.map((item, index) => (
                    <tr
                      key={item.id}
                      className={index % 2 === 1 ? 'bg-slate-50/40' : undefined}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-50">
                          {item.tenant.cafeName}
                        </div>
                        <div className="mt-0.5 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-200">
                          {item.tenant.id}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-50">{item.plan.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-300">
                          Rs. {item.plan.price.toLocaleString('en-NP')} ·{' '}
                          {item.plan.durationDays} days
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-50">
                          Rs.{' '}
                          {(item.paidAmount ?? item.plan.price).toLocaleString('en-NP')}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {item.transactionId ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-900">
                            {item.transactionId}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                            Not provided
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-200 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-emerald-300"
                            onClick={() => void handleApprove(item.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full border border-red-400/80 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100 shadow-sm hover:bg-red-500/30"
                            onClick={() => openRejectModal(item.id)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      <Modal
        isOpen={selectedId != null}
        onClose={() => {
          if (rejecting) return
          setSelectedId(null)
          setRejectNote('')
        }}
        title="Reject subscription payment"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Add a short internal note explaining why this payment is being rejected. This
            helps your team keep a clear audit trail.
          </p>
          <div>
            <label
              htmlFor="reject-note"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Rejection note<span className="text-red-500">*</span>
            </label>
            <textarea
              id="reject-note"
              rows={4}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Example: Payment amount does not match the selected plan."
            />
            <p className="mt-1 text-xs text-slate-500">
              This note is stored server-side and can be surfaced in future admin
              reporting.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={rejecting}
              onClick={() => {
                if (rejecting) return
                setSelectedId(null)
                setRejectNote('')
              }}
              className="inline-flex justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={rejecting}
              onClick={() => void confirmReject()}
              className="inline-flex justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              {rejecting ? 'Rejecting...' : 'Reject payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

