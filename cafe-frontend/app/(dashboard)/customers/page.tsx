'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import { customersApi } from '@/lib/api'
import { useLocalCollection, refreshLocal, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'

type CustomerType = 'CUSTOMER' | 'CREDITOR'

interface Customer {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  type: CustomerType
  creditBalance: number
  createdAt: string
}

interface CreditHistoryEntry {
  id: string
  amount: number
  type: 'CREDIT' | 'PAYMENT'
  balanceAfter: number
  note?: string | null
  createdAt: string
}

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  type: 'CUSTOMER' as CustomerType,
  creditBalance: '',
}

export default function CustomersPage() {
  const customers = useLocalCollection<Customer>('customers', customersApi.getCustomers)
  const loading = customers === undefined
  const [customerSubmitting, setCustomerSubmitting] = useState(false)
  const [creditSubmitting, setCreditSubmitting] = useState(false)
  const [filter, setFilter] = useState<'ALL' | CustomerType>('ALL')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [creditModal, setCreditModal] = useState<Customer | null>(null)
  const [historyModal, setHistoryModal] = useState<Customer | null>(null)
  const [creditHistory, setCreditHistory] = useState<CreditHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [creditForm, setCreditForm] = useState({
    amount: '',
    type: 'PAYMENT' as 'PAYMENT' | 'CREDIT',
    note: '',
  })
  const refreshCustomers = () => refreshLocal('customers', customersApi.getCustomers)

  const filtered =
    filter === 'ALL'
      ? (customers ?? [])
      : (customers ?? []).filter((c) => c.type === filter)

  /** Credit amounts are integer-only (no decimals) */
  const roundCredit = (n: number) => Math.round(n)

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showToast('Name is required', 'error')
      return
    }

    const payload: {
      name: string
      phone?: string
      email?: string
      address?: string
      notes?: string
      type?: CustomerType
      creditBalance?: number
    } = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      type: formData.type,
    }

    if (formData.type === 'CREDITOR') {
      const raw = formData.creditBalance.trim()
      if (raw !== '') {
        const opening = roundCredit(parseFloat(raw))
        if (!Number.isFinite(opening) || opening < 0) {
          showToast('Enter a valid opening balance (0 or more)', 'error')
          return
        }
        payload.creditBalance = opening
      }
    }

    await optimisticCreate('customers',
      { ...payload, creditBalance: payload.creditBalance || 0, createdAt: new Date().toISOString() },
      () => customersApi.createCustomer(payload),
      { endpoint: '/customers', body: payload }
    )
    showToast('Customer added', 'success')
    setIsAddOpen(false)
    setFormData(emptyForm)
  }

  const handleUpdate = async () => {
    if (!editing) return
    if (!formData.name.trim()) {
      showToast('Name is required', 'error')
      return
    }

    const payload: {
      name?: string
      phone?: string
      email?: string
      address?: string
      notes?: string
      type?: CustomerType
      creditBalance?: number
    } = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      type: formData.type,
    }

    if (formData.type === 'CREDITOR') {
      const raw = formData.creditBalance.trim()
      if (raw !== '') {
        const balance = roundCredit(parseFloat(raw))
        if (!Number.isFinite(balance) || balance < 0) {
          showToast('Enter a valid balance (0 or more)', 'error')
          return
        }
        payload.creditBalance = balance
      }
    }

    await optimisticUpdate('customers', editing.id,
      payload,
      () => customersApi.updateCustomer(editing.id, payload),
      { endpoint: `/customers/${editing.id}`, body: payload }
    )
    showToast('Customer updated', 'success')
    setEditing(null)
    setIsEditOpen(false)
    setFormData(emptyForm)
  }

  const handleDelete = async (id: string) => {
    const ok = await appConfirm({
      title: 'Remove customer',
      message: 'Remove this customer from the list?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('customers', id,
      () => customersApi.deleteCustomer(id),
      { endpoint: `/customers/${id}` }
    )
    showToast('Customer removed', 'success')
  }

  const handleCreditSubmit = async () => {
    if (!creditModal) return
    const amount = roundCredit(parseFloat(creditForm.amount))
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid amount', 'error')
      return
    }

    if (creditModal.type !== 'CREDITOR') {
      showToast('Only creditors can have a credit balance', 'error')
      return
    }

    const currentBalance = roundCredit(Number(creditModal.creditBalance) || 0)
    if (creditForm.type === 'PAYMENT' && amount > currentBalance) {
      showToast('Payment amount cannot exceed current balance', 'error')
      return
    }

    try {
      setCreditSubmitting(true)
      await customersApi.updateCredit(creditModal.id, {
        amount,
        type: creditForm.type,
        note: creditForm.note.trim() || undefined,
      })
      await refreshCustomers()
      showToast(
        creditForm.type === 'PAYMENT' ? 'Payment recorded' : 'Credit added',
        'success'
      )
      setCreditModal(null)
      setCreditForm({ amount: '', type: 'PAYMENT', note: '' })
    } catch (error: any) {
      showToast(error.message || 'Failed to update credit', 'error')
    } finally {
      setCreditSubmitting(false)
    }
  }

  const openEdit = (c: Customer) => {
    setEditing(c)
    setIsEditOpen(true)
    setFormData({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
      type: c.type,
      creditBalance:
        c.type === 'CREDITOR' ? String(roundCredit(Number(c.creditBalance))) : '',
    })
  }

  const openHistory = async (c: Customer) => {
    if (c.type !== 'CREDITOR') return
    setHistoryModal(c)
    setHistoryLoading(true)
    setCreditHistory([])
    try {
      const data = await customersApi.getCreditHistory(c.id)
      setCreditHistory(data)
    } catch (error: any) {
      showToast(error.message || 'Failed to load history', 'error')
      setHistoryModal(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Customers & Creditors
        </h1>
        <button
          type="button"
          onClick={() => {
            setFormData(emptyForm)
            setIsAddOpen(true)
          }}
          className="w-full sm:w-auto min-h-[44px] bg-red-700 text-white px-4 py-2.5 rounded-lg hover:bg-red-800 active:bg-red-900 font-medium"
        >
          + Add Customer
        </button>
      </div>

      {/* Tabs - scroll on narrow screens */}
      <div className="flex gap-2 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
        {(['ALL', 'CUSTOMER', 'CREDITOR'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`shrink-0 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-t-lg -mb-px ${
              filter === tab
                ? 'bg-white border border-b-0 border-gray-200 text-red-700'
                : 'text-gray-600 hover:text-gray-900 active:bg-gray-100'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab === 'CUSTOMER' ? 'Customers' : 'Creditors'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-700 font-medium mb-2">No entries yet</p>
          <p className="text-gray-600 text-sm">
            {filter === 'ALL'
              ? 'Add a customer or creditor to get started.'
              : filter === 'CUSTOMER'
                ? 'No customers in this list.'
                : 'No creditors in this list.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto -mx-3 sm:mx-0 sm:rounded-xl">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900">
                    Name
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900 hidden sm:table-cell">
                    Contact
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900">
                    Type
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900">
                    Balance
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900 w-28 sm:w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 active:bg-gray-100">
                    <td className="px-3 sm:px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      {c.address && (
                        <p className="text-xs text-gray-500 sm:hidden truncate max-w-[180px]">
                          {c.address}
                        </p>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {c.phone && <span>{c.phone}</span>}
                      {c.phone && c.email && ' · '}
                      {c.email && <span>{c.email}</span>}
                      {!c.phone && !c.email && '—'}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.type === 'CREDITOR'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.type === 'CREDITOR' ? 'Creditor' : 'Customer'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm">
                      {c.type === 'CREDITOR' ? (
                        <span className="font-medium text-gray-900">
                          Rs. {roundCredit(Number(c.creditBalance))}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="flex items-center gap-1 sm:gap-2">
                        {c.type === 'CREDITOR' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openHistory(c)}
                              className="min-h-[40px] min-w-[44px] flex items-center justify-center px-2 text-xs font-medium text-gray-600 hover:text-gray-900 active:bg-gray-100 rounded"
                              title="View history"
                            >
                              History
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCreditModal(c)
                                setCreditForm({ amount: '', type: 'PAYMENT', note: '' })
                              }}
                              className="min-h-[40px] min-w-[44px] flex items-center justify-center px-2 text-xs font-medium text-blue-600 hover:text-blue-800 active:bg-blue-50 rounded"
                              title="Credit"
                            >
                              Credit
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="min-h-[40px] min-w-[44px] flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded active:bg-gray-200"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="min-h-[40px] min-w-[44px] flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-red-50 rounded active:bg-red-100"
                          title="Remove"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Customer / Creditor"
      >
        <CustomerForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreate}
          onCancel={() => setIsAddOpen(false)}
          submitting={customerSubmitting}
          submitLabel="Add"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setEditing(null)
          setIsEditOpen(false)
          setFormData(emptyForm)
        }}
        title="Edit Customer / Creditor"
      >
        <CustomerForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleUpdate}
          onCancel={() => {
            setEditing(null)
            setIsEditOpen(false)
            setFormData(emptyForm)
          }}
          submitting={customerSubmitting}
          submitLabel="Update"
        />
      </Modal>

      {/* Credit modal (payment / add credit) */}
      <Modal
        isOpen={!!creditModal}
        onClose={() => {
          setCreditModal(null)
          setCreditForm({ amount: '', type: 'PAYMENT', note: '' })
        }}
        title={creditModal ? `Credit – ${creditModal.name}` : ''}
      >
        {creditModal && (
          <CreditModalContent
            creditModal={creditModal}
            creditForm={creditForm}
            setCreditForm={setCreditForm}
            onCancel={() => {
              setCreditModal(null)
              setCreditForm({ amount: '', type: 'PAYMENT', note: '' })
            }}
            onSubmit={handleCreditSubmit}
            submitting={creditSubmitting}
          />
        )}
      </Modal>

      {/* Credit history modal (creditors only) */}
      <Modal
        isOpen={!!historyModal}
        onClose={() => setHistoryModal(null)}
        title={historyModal ? `History – ${historyModal.name}` : ''}
      >
        {historyModal && (
          <div className="space-y-4">
            <div className="bg-slate-100 rounded-lg p-3 text-center">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Current balance
              </p>
              <p className="text-xl font-bold text-gray-900">
                Rs. {Math.round(Number(historyModal.creditBalance))}
              </p>
            </div>
            {historyLoading ? (
              <p className="text-center text-gray-500 py-4">Loading history…</p>
            ) : creditHistory.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No credit or payment entries yet.
              </p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Type
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">
                        Balance after
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Note
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {creditHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              entry.type === 'PAYMENT'
                                ? 'text-emerald-600 font-medium'
                                : 'text-amber-600 font-medium'
                            }
                          >
                            {entry.type === 'PAYMENT' ? 'Payment' : 'Credit'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">
                          {entry.type === 'PAYMENT' ? '−' : '+'} Rs.{' '}
                          {Math.round(entry.amount)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                          Rs. {Math.round(entry.balanceAfter)}
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-[220px] whitespace-pre-wrap break-words align-top">
                          {entry.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModal(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000]

function CreditModalContent({
  creditModal,
  creditForm,
  setCreditForm,
  onCancel,
  onSubmit,
  submitting,
}: {
  creditModal: Customer
  creditForm: { amount: string; type: 'PAYMENT' | 'CREDIT'; note: string }
  setCreditForm: React.Dispatch<
    React.SetStateAction<{ amount: string; type: 'PAYMENT' | 'CREDIT'; note: string }>
  >
  onCancel: () => void
  onSubmit: () => void
  submitting: boolean
}) {
  const roundCredit = (n: number) => Math.round(n)
  const balance = roundCredit(Number(creditModal.creditBalance))
  const amountNum = roundCredit(parseFloat(creditForm.amount) || 0)
  const newBalance = roundCredit(
    creditForm.type === 'PAYMENT'
      ? Math.max(0, balance - amountNum)
      : balance + amountNum
  )

  const addToAmount = (value: number) => {
    const current = roundCredit(parseFloat(creditForm.amount) || 0)
    const next = roundCredit(current + value)
    setCreditForm((f) => ({ ...f, amount: String(next) }))
  }

  const setPayFull = () => {
    setCreditForm((f) => ({ ...f, amount: String(balance) }))
  }

  const normalizeAmountToInteger = () => {
    const num = parseFloat(creditForm.amount)
    if (!Number.isNaN(num) && creditForm.amount.trim() !== '') {
      const rounded = roundCredit(num)
      const str = String(rounded)
      if (str !== creditForm.amount) setCreditForm((f) => ({ ...f, amount: str }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-100 rounded-lg p-3 text-center">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          Current balance
        </p>
        <p className="text-xl font-bold text-gray-900">
          Rs. {balance}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Action
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCreditForm((f) => ({ ...f, type: 'PAYMENT' }))}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              creditForm.type === 'PAYMENT'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Record Payment
          </button>
          <button
            type="button"
            onClick={() => setCreditForm((f) => ({ ...f, type: 'CREDIT' }))}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              creditForm.type === 'CREDIT'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Add Credit
          </button>
        </div>
      </div>

      {creditForm.type === 'PAYMENT' && balance > 0 && (
        <button
          type="button"
          onClick={setPayFull}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200"
        >
          Pay full balance (Rs. {balance})
        </button>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Amount (Rs.)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={creditForm.amount}
            onChange={(e) =>
              setCreditForm((f) => ({ ...f, amount: e.target.value }))
            }
            onBlur={normalizeAmountToInteger}
            placeholder="0"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
          />
          <button
            type="button"
            onClick={() => setCreditForm((f) => ({ ...f, amount: '' }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => addToAmount(n)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            + {n}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note (optional)
        </label>
        <textarea
          value={creditForm.note}
          onChange={(e) =>
            setCreditForm((f) => ({ ...f, note: e.target.value }))
          }
          placeholder="e.g. Cash payment, Invoice #123 (new lines allowed)"
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 resize-y min-h-[80px]"
        />
      </div>

      {creditForm.amount.trim() !== '' && amountNum > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p className="text-gray-600">Preview balance after this action</p>
          <p className="font-semibold text-gray-900 text-lg">
            Preview: Rs. {newBalance}
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function CustomerForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: {
  formData: typeof emptyForm
  setFormData: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
  submitLabel: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
          placeholder="Full name"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone
        </label>
        <input
          type="text"
          inputMode="tel"
          value={formData.phone}
          onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
          placeholder="Phone number"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="text"
          inputMode="email"
          value={formData.email}
          onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
          placeholder="Email"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
          placeholder="Address"
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Optional notes (e.g. payment terms, contact preferences)"
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              if (formData.type === 'CREDITOR') {
                const ok = await appConfirm({
                  title: 'Switch to customer?',
                  message: 'This will reset credit balance to 0. Continue?',
                  confirmText: 'Yes, continue',
                  cancelText: 'Cancel',
                  destructive: true,
                })
                if (!ok) return
              }
              setFormData((f) => ({ ...f, type: 'CUSTOMER', creditBalance: '' }))
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              formData.type === 'CUSTOMER'
                ? 'bg-slate-700 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() =>
              setFormData((f) => ({ ...f, type: 'CREDITOR' }))
            }
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              formData.type === 'CREDITOR'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Creditor
          </button>
        </div>
      </div>
      {formData.type === 'CREDITOR' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opening balance (Rs.) – whole numbers only
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={formData.creditBalance}
            onChange={(e) =>
              setFormData((f) => ({ ...f, creditBalance: e.target.value }))
            }
            placeholder="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
          />
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  )
}
