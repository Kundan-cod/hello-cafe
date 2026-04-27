'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import { vendorsApi, type VendorPurchaseItemDto } from '@/lib/api'
import { useLocalCollection, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'

interface Vendor {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  createdAt: string
}

interface VendorPurchaseItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
}

interface VendorPurchase {
  id: string
  vendorId: string
  totalAmount: number
  paidAmount: number
  note?: string | null
  createdAt: string
  items: VendorPurchaseItem[]
}

const emptyVendorForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

const emptyPurchaseForm = {
  totalAmount: '',
  paidAmount: '',
  note: '',
  items: [] as { productName: string; quantity: string; unitPrice: string; inventoryProductId: string }[],
}

export default function VendorsPage() {
  const vendors = useLocalCollection<Vendor>('vendors', vendorsApi.getVendors)
  const loading = vendors === undefined
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [vendorForm, setVendorForm] = useState(emptyVendorForm)
  const [submitting, setSubmitting] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<VendorPurchase[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false)
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm)
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false)
  const [paymentModal, setPaymentModal] = useState<VendorPurchase | null>(null)
  const [paymentForm, setPaymentForm] = useState({ paidAmount: '', note: '' })
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  const openVendorDetail = async (v: Vendor) => {
    setSelectedVendor(v)
    setHistoryLoading(true)
    setPurchaseHistory([])
    try {
      const data = await vendorsApi.getPurchaseHistory(v.id)
      setPurchaseHistory(data)
    } catch (error: any) {
      showToast(error.message || 'Failed to load purchase history', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleCreateVendor = async () => {
    if (!vendorForm.name.trim()) {
      showToast('Vendor name is required', 'error')
      return
    }
    const payload = {
      name: vendorForm.name.trim(),
      phone: vendorForm.phone.trim() || undefined,
      email: vendorForm.email.trim() || undefined,
      address: vendorForm.address.trim() || undefined,
      notes: vendorForm.notes.trim() || undefined,
    }
    await optimisticCreate('vendors', payload, () => vendorsApi.createVendor(payload), { endpoint: '/vendors', body: payload })
    showToast('Vendor added', 'success')
    setIsAddOpen(false)
    setVendorForm(emptyVendorForm)
  }

  const handleUpdateVendor = async () => {
    if (!editing) return
    if (!vendorForm.name.trim()) {
      showToast('Vendor name is required', 'error')
      return
    }
    const payload = {
      name: vendorForm.name.trim(),
      phone: vendorForm.phone.trim() || undefined,
      email: vendorForm.email.trim() || undefined,
      address: vendorForm.address.trim() || undefined,
      notes: vendorForm.notes.trim() || undefined,
    }
    await optimisticUpdate('vendors', editing.id, payload, () => vendorsApi.updateVendor(editing.id, payload), { endpoint: `/vendors/${editing.id}`, body: payload })
    if (selectedVendor?.id === editing.id) {
      setSelectedVendor((prev) => (prev ? { ...prev, ...vendorForm } : null))
    }
    showToast('Vendor updated', 'success')
    setEditing(null)
    setIsEditOpen(false)
    setVendorForm(emptyVendorForm)
  }

  const handleDeleteVendor = async (id: string) => {
    const ok = await appConfirm({
      title: 'Remove vendor',
      message: 'Remove this vendor from the list?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('vendors', id, () => vendorsApi.deleteVendor(id), { endpoint: `/vendors/${id}` })
    if (selectedVendor?.id === id) setSelectedVendor(null)
    showToast('Vendor removed', 'success')
  }

  const openEdit = (v: Vendor) => {
    setEditing(v)
    setVendorForm({
      name: v.name,
      phone: v.phone ?? '',
      email: v.email ?? '',
      address: v.address ?? '',
      notes: v.notes ?? '',
    })
    setIsEditOpen(true)
  }

  const openAddPurchase = () => {
    setPurchaseForm({
      ...emptyPurchaseForm,
      items: [{ productName: '', quantity: '', unitPrice: '', inventoryProductId: '' }],
    })
    setIsPurchaseOpen(true)
  }

  const addPurchaseRow = () => {
    setPurchaseForm((f) => ({
      ...f,
      items: [...f.items, { productName: '', quantity: '', unitPrice: '', inventoryProductId: '' }],
    }))
  }

  const removePurchaseRow = (index: number) => {
    setPurchaseForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }))
  }

  const updatePurchaseRow = (
    index: number,
    field: keyof (typeof purchaseForm.items)[0],
    value: string
  ) => {
    setPurchaseForm((f) => ({
      ...f,
      items: f.items.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }))
  }

  const handleCreatePurchase = async () => {
    if (!selectedVendor) return
    const total = parseFloat(purchaseForm.totalAmount)
    const paid = parseFloat(purchaseForm.paidAmount)
    if (!Number.isFinite(total) || total < 0) {
      showToast('Enter a valid total amount', 'error')
      return
    }
    if (!Number.isFinite(paid) || paid < 0 || paid > total) {
      showToast('Paid amount must be between 0 and total', 'error')
      return
    }
    const items: VendorPurchaseItemDto[] = []
    for (const row of purchaseForm.items) {
      if (!row.productName.trim()) continue
      const qty = parseFloat(row.quantity)
      const up = parseFloat(row.unitPrice)
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(up) || up < 0) {
        showToast('Invalid quantity or unit price in an item', 'error')
        return
      }
      items.push({
        productName: row.productName.trim(),
        quantity: qty,
        unitPrice: up,
        inventoryProductId: row.inventoryProductId.trim() || undefined,
      })
    }
    try {
      setPurchaseSubmitting(true)
      await vendorsApi.createPurchase(selectedVendor.id, {
        totalAmount: total,
        paidAmount: paid,
        note: purchaseForm.note.trim() || undefined,
        items,
      })
      const data = await vendorsApi.getPurchaseHistory(selectedVendor.id)
      setPurchaseHistory(data)
      showToast('Purchase recorded', 'success')
      setIsPurchaseOpen(false)
      setPurchaseForm(emptyPurchaseForm)
    } catch (error: any) {
      showToast(error.message || 'Failed to record purchase', 'error')
    } finally {
      setPurchaseSubmitting(false)
    }
  }

  const handleUpdatePayment = async () => {
    if (!paymentModal || !selectedVendor) return
    const paid = parseFloat(paymentForm.paidAmount)
    if (!Number.isFinite(paid) || paid < 0 || paid > paymentModal.totalAmount) {
      showToast('Paid amount must be between 0 and total amount', 'error')
      return
    }
    try {
      setPaymentSubmitting(true)
      await vendorsApi.updatePurchasePayment(
        selectedVendor.id,
        paymentModal.id,
        { paidAmount: paid, note: paymentForm.note.trim() || undefined }
      )
      const data = await vendorsApi.getPurchaseHistory(selectedVendor.id)
      setPurchaseHistory(data)
      showToast('Payment updated', 'success')
      setPaymentModal(null)
      setPaymentForm({ paidAmount: '', note: '' })
    } catch (error: any) {
      showToast(error.message || 'Failed to update payment', 'error')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' })
  const formatRs = (n: number) => `Rs. ${Math.round(n)}`

  if (loading) return <Loading />

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Vendors</h1>
        <button
          type="button"
          onClick={() => {
            setVendorForm(emptyVendorForm)
            setIsAddOpen(true)
          }}
          className="w-full sm:w-auto min-h-[44px] bg-red-700 text-white px-4 py-2.5 rounded-lg hover:bg-red-800 font-medium"
        >
          + Add Vendor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">
            Vendor list
          </div>
          <ul className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
            {(vendors ?? []).length === 0 ? (
              <li className="px-4 py-8 text-center text-gray-500">
                No vendors yet. Add one to get started.
              </li>
            ) : (
              (vendors ?? []).map((v) => (
                <li
                  key={v.id}
                  className={`flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 ${
                    selectedVendor?.id === v.id ? 'bg-red-50 border-l-4 border-red-700' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openVendorDetail(v)}
                    className="flex-1 text-left min-w-0 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 py-1"
                  >
                    <p className="font-medium text-gray-900 truncate">{v.name}</p>
                    {(v.phone || v.email) && (
                      <p className="text-sm text-gray-500 truncate">
                        {[v.phone, v.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(v)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteVendor(v.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Remove"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="font-medium text-gray-900">
              {selectedVendor ? `${selectedVendor.name} – Purchase history` : 'Select a vendor'}
            </span>
            {selectedVendor && (
              <button
                type="button"
                onClick={openAddPurchase}
                className="text-sm bg-red-700 text-white px-3 py-1.5 rounded-lg hover:bg-red-800"
              >
                + Add Purchase
              </button>
            )}
          </div>
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {!selectedVendor ? (
              <p className="text-gray-500 text-center py-8">
                Select a vendor to view purchase history and add purchases.
              </p>
            ) : historyLoading ? (
              <p className="text-gray-500 text-center py-8">Loading…</p>
            ) : purchaseHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No purchases yet. Add a purchase to track products, paid amount, and balance.
              </p>
            ) : (
              <div className="space-y-4">
                {purchaseHistory.map((p) => {
                  const left = Math.max(0, p.totalAmount - p.paidAmount)
                  return (
                    <div
                      key={p.id}
                      className="border border-gray-200 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-gray-500">
                          {formatDate(p.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModal(p)
                            setPaymentForm({
                              paidAmount: String(p.paidAmount),
                              note: p.note ?? '',
                            })
                          }}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Update payment
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Total</p>
                          <p className="font-semibold text-gray-900">{formatRs(p.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Paid</p>
                          <p className="font-semibold text-emerald-600">{formatRs(p.paidAmount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Left</p>
                          <p className="font-semibold text-amber-600">{formatRs(left)}</p>
                        </div>
                      </div>
                      {p.note && (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{p.note}</p>
                      )}
                      <div className="text-sm">
                        <p className="font-medium text-gray-700 mb-1">Products</p>
                        <ul className="list-disc list-inside text-gray-600">
                          {p.items.map((i) => (
                            <li key={i.id}>
                              {i.productName} – {i.quantity} × {formatRs(i.unitPrice)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Vendor Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Vendor">
        <VendorForm
          form={vendorForm}
          setForm={setVendorForm}
          onSubmit={handleCreateVendor}
          onCancel={() => setIsAddOpen(false)}
          submitting={submitting}
          submitLabel="Add"
        />
      </Modal>

      {/* Edit Vendor Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setEditing(null)
          setIsEditOpen(false)
        }}
        title="Edit Vendor"
      >
        <VendorForm
          form={vendorForm}
          setForm={setVendorForm}
          onSubmit={handleUpdateVendor}
          onCancel={() => {
            setEditing(null)
            setIsEditOpen(false)
          }}
          submitting={submitting}
          submitLabel="Update"
        />
      </Modal>

      {/* Add Purchase Modal */}
      <Modal
        isOpen={isPurchaseOpen}
        onClose={() => setIsPurchaseOpen(false)}
        title="Add Purchase"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total (Rs.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchaseForm.totalAmount}
                onChange={(e) =>
                  setPurchaseForm((f) => ({ ...f, totalAmount: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid (Rs.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchaseForm.paidAmount}
                onChange={(e) =>
                  setPurchaseForm((f) => ({ ...f, paidAmount: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={purchaseForm.note}
              onChange={(e) =>
                setPurchaseForm((f) => ({ ...f, note: e.target.value }))
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Products</label>
              <button
                type="button"
                onClick={addPurchaseRow}
                className="text-sm text-red-700 font-medium"
              >
                + Add row
              </button>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {purchaseForm.items.map((row, idx) => (
                <div key={idx} className="flex flex-wrap gap-2 items-start border border-gray-200 p-2 rounded">
                  <input
                    type="text"
                    placeholder="Product name"
                    value={row.productName}
                    onChange={(e) => updatePurchaseRow(idx, 'productName', e.target.value)}
                    className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-500"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    min="0"
                    step="any"
                    value={row.quantity}
                    onChange={(e) => updatePurchaseRow(idx, 'quantity', e.target.value)}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-500"
                  />
                  <input
                    type="number"
                    placeholder="Unit price"
                    min="0"
                    step="0.01"
                    value={row.unitPrice}
                    onChange={(e) => updatePurchaseRow(idx, 'unitPrice', e.target.value)}
                    className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => removePurchaseRow(idx)}
                    className="p-1.5 text-gray-500 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsPurchaseOpen(false)}
              className="flex-1 border border-gray-400 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-100 bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreatePurchase}
              disabled={purchaseSubmitting}
              className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
            >
              {purchaseSubmitting ? 'Saving...' : 'Save Purchase'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Update Payment Modal */}
      <Modal
        isOpen={!!paymentModal}
        onClose={() => {
          setPaymentModal(null)
          setPaymentForm({ paidAmount: '', note: '' })
        }}
        title="Update payment"
      >
        {paymentModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Total: {formatRs(paymentModal.totalAmount)}. Enter paid amount (0–total).
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid (Rs.)</label>
              <input
                type="number"
                min="0"
                max={paymentModal.totalAmount}
                step="0.01"
                value={paymentForm.paidAmount}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, paidAmount: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea
                value={paymentForm.note}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, note: e.target.value }))
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentModal(null)
                  setPaymentForm({ paidAmount: '', note: '' })
                }}
                className="flex-1 border border-gray-400 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-100 bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdatePayment}
                disabled={paymentSubmitting}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
              >
                {paymentSubmitting ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function VendorForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: {
  form: typeof emptyVendorForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptyVendorForm>>
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
  submitLabel: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="text"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="text"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <textarea
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-400 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-100 bg-white"
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
