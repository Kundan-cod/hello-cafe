'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import { discountsApi, menuApi } from '@/lib/api'
import type { DiscountScope } from '@/lib/api'
import { useLocalCollection, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'

interface Discount {
  id: string
  name: string
  code?: string | null
  type: DiscountType
  value: number
  scope?: string
  categoryIds?: string[] | null
  menuItemIds?: string[] | null
  minOrderAmount?: number | null
  validFrom?: string | null
  validTo?: string | null
  isActive: boolean
  createdAt: string
}

interface Category {
  id: string
  name: string
}

interface MenuItem {
  id: string
  name: string
  categoryId: string
}

const emptyForm = {
  name: '',
  code: '',
  type: 'PERCENTAGE' as DiscountType,
  value: '',
  scope: 'ALL' as DiscountScope,
  categoryIds: [] as string[],
  menuItemIds: [] as string[],
  minOrderAmount: '',
  validFrom: '',
  validTo: '',
}

function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DiscountsPage() {
  const discounts = useLocalCollection<Discount>('discounts', () => discountsApi.getDiscounts(false))
  const categories = useLocalCollection<Category>('menuCategories', menuApi.getCategories)
  const menuItems = useLocalCollection<MenuItem>('menuItems', menuApi.getItems)
  const loading = discounts === undefined || categories === undefined || menuItems === undefined
  const [submitting, setSubmitting] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [formData, setFormData] = useState(emptyForm)

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showToast('Offer name is required', 'error')
      return
    }
    const valueNum = parseFloat(formData.value)
    if (!Number.isFinite(valueNum) || valueNum < 0) {
      showToast('Enter a valid value', 'error')
      return
    }
    if (formData.type === 'PERCENTAGE' && valueNum > 100) {
      showToast('Percentage cannot exceed 100', 'error')
      return
    }
    if (formData.scope === 'CATEGORY' && formData.categoryIds.length === 0) {
      showToast('Select at least one category', 'error')
      return
    }
    if (formData.scope === 'ITEM' && formData.menuItemIds.length === 0) {
      showToast('Select at least one menu item', 'error')
      return
    }
    const minParsed = parseFloat(formData.minOrderAmount)
    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      type: formData.type,
      value: valueNum,
      scope: formData.scope,
      categoryIds: formData.scope === 'CATEGORY' ? formData.categoryIds : undefined,
      menuItemIds: formData.scope === 'ITEM' ? formData.menuItemIds : undefined,
      minOrderAmount: Number.isFinite(minParsed) ? minParsed : undefined,
      validFrom: formData.validFrom.trim() || undefined,
      validTo: formData.validTo.trim() || undefined,
    }
    await optimisticCreate('discounts', payload, () => discountsApi.createDiscount(payload), { endpoint: '/discounts', body: payload })
    setIsAddOpen(false)
    setFormData(emptyForm)
    showToast('Offer created', 'success')
  }

  const handleUpdate = async () => {
    if (!editing) return
    if (!formData.name.trim()) {
      showToast('Offer name is required', 'error')
      return
    }
    const valueNum = parseFloat(formData.value)
    if (!Number.isFinite(valueNum) || valueNum < 0) {
      showToast('Enter a valid value', 'error')
      return
    }
    if (formData.type === 'PERCENTAGE' && valueNum > 100) {
      showToast('Percentage cannot exceed 100', 'error')
      return
    }
    if (formData.scope === 'CATEGORY' && formData.categoryIds.length === 0) {
      showToast('Select at least one category', 'error')
      return
    }
    if (formData.scope === 'ITEM' && formData.menuItemIds.length === 0) {
      showToast('Select at least one menu item', 'error')
      return
    }
    const minParsed = parseFloat(formData.minOrderAmount)
    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      type: formData.type,
      value: valueNum,
      scope: formData.scope,
      categoryIds: formData.scope === 'CATEGORY' ? formData.categoryIds : undefined,
      menuItemIds: formData.scope === 'ITEM' ? formData.menuItemIds : undefined,
      minOrderAmount: Number.isFinite(minParsed) ? minParsed : undefined,
      validFrom: formData.validFrom.trim() || null,
      validTo: formData.validTo.trim() || null,
    }
    await optimisticUpdate('discounts', editing.id, payload, () => discountsApi.updateDiscount(editing.id, payload), { endpoint: `/discounts/${editing.id}`, body: payload })
    setEditing(null)
    setFormData(emptyForm)
    showToast('Offer updated', 'success')
  }

  const handleToggleActive = async (d: Discount) => {
    const changes = { isActive: !d.isActive }
    await optimisticUpdate('discounts', d.id, changes, () => discountsApi.updateDiscount(d.id, changes))
    showToast(d.isActive ? 'Offer deactivated' : 'Offer activated', 'success')
  }

  const handleDelete = async (id: string) => {
    const ok = await appConfirm({
      title: 'Remove offer',
      message: 'Remove this offer? It will no longer be available at billing.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('discounts', id, () => discountsApi.deleteDiscount(id), { endpoint: `/discounts/${id}` })
    showToast('Offer removed', 'success')
  }

  const openEdit = (d: Discount) => {
    setEditing(d)
    setFormData({
      name: d.name,
      code: d.code ?? '',
      type: d.type,
      value: String(d.value),
      scope: (d.scope as DiscountScope) ?? 'ALL',
      categoryIds: d.categoryIds && Array.isArray(d.categoryIds) ? d.categoryIds : [],
      menuItemIds: d.menuItemIds && Array.isArray(d.menuItemIds) ? d.menuItemIds : [],
      minOrderAmount: d.minOrderAmount != null ? String(d.minOrderAmount) : '',
      validFrom: d.validFrom ? d.validFrom.slice(0, 10) : '',
      validTo: d.validTo ? d.validTo.slice(0, 10) : '',
    })
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Discount & Offers
        </h1>
        <button
          type="button"
          onClick={() => {
            setFormData(emptyForm)
            setIsAddOpen(true)
          }}
          className="bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-800 font-medium"
        >
          + Add Offer
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Create offers with a code (e.g. SAVE10). Staff can apply them at order billing by entering the code or selecting the offer.
      </p>

      {(discounts ?? []).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-700 font-medium mb-2">No offers yet</p>
          <p className="text-gray-600 text-sm">Add an offer to use at billing.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Code</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Scope</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Value</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900 hidden sm:table-cell">Min order</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900 hidden md:table-cell">Valid</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900 w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(discounts ?? []).map((d) => (
                  <tr key={d.id} className={!d.isActive ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-3 text-sm">
                      {d.code ? (
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800">{d.code}</code>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {d.scope === 'ALL'
                        ? 'All items'
                        : d.scope === 'CATEGORY'
                        ? `Category (${Array.isArray(d.categoryIds) ? d.categoryIds.length : 0})`
                        : `Item (${Array.isArray(d.menuItemIds) ? d.menuItemIds.length : 0})`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          d.type === 'PERCENTAGE' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {d.type === 'PERCENTAGE' ? d.value + '%' : 'Rs. ' + d.value}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {d.type === 'PERCENTAGE' ? `${d.value}% off` : `Rs. ${d.value} off`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {d.minOrderAmount != null ? `Rs. ${d.minOrderAmount}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                      {formatDate(d.validFrom)} – {formatDate(d.validTo)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(d)}
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          d.isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {d.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="text-gray-600 hover:text-red-600"
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

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Offer">
        <OfferForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreate}
          onCancel={() => setIsAddOpen(false)}
          submitting={submitting}
          submitLabel="Add"
          categories={categories ?? []}
          menuItems={menuItems ?? []}
        />
      </Modal>

      <Modal
        isOpen={!!editing}
        onClose={() => {
          setEditing(null)
          setFormData(emptyForm)
        }}
        title="Edit Offer"
      >
        <OfferForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleUpdate}
          onCancel={() => {
            setEditing(null)
            setFormData(emptyForm)
          }}
          submitting={submitting}
          submitLabel="Update"
          categories={categories ?? []}
          menuItems={menuItems ?? []}
        />
      </Modal>
    </div>
  )
}

function OfferForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
  categories,
  menuItems,
}: {
  formData: typeof emptyForm
  setFormData: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
  submitLabel: string
  categories: Category[]
  menuItems: MenuItem[]
}) {
  const toggleCategory = (id: string) => {
    setFormData((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((c) => c !== id) : [...f.categoryIds, id],
    }))
  }
  const toggleMenuItem = (id: string) => {
    setFormData((f) => ({
      ...f,
      menuItemIds: f.menuItemIds.includes(id) ? f.menuItemIds.filter((m) => m !== id) : [...f.menuItemIds, id],
    }))
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Happy Hour 20%"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Code (optional)</label>
        <input
          type="text"
          value={formData.code}
          onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          placeholder="e.g. SAVE10"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
        <p className="text-xs text-gray-500 mt-1">Staff will enter this at billing to apply the offer.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Apply to</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormData((f) => ({ ...f, scope: 'ALL', categoryIds: [], menuItemIds: [] }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              formData.scope === 'ALL' ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            All items
          </button>
          <button
            type="button"
            onClick={() => setFormData((f) => ({ ...f, scope: 'CATEGORY', menuItemIds: [] }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              formData.scope === 'CATEGORY' ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Certain categories
          </button>
          <button
            type="button"
            onClick={() => setFormData((f) => ({ ...f, scope: 'ITEM', categoryIds: [] }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              formData.scope === 'ITEM' ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Certain items
          </button>
        </div>
      </div>
      {formData.scope === 'CATEGORY' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select categories *</label>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.categoryIds.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-800">{c.name}</span>
              </label>
            ))}
            {categories.length === 0 && <p className="text-xs text-gray-500">No categories. Add categories in Menu.</p>}
          </div>
        </div>
      )}
      {formData.scope === 'ITEM' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select menu items *</label>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
            {menuItems.map((item) => (
              <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.menuItemIds.includes(item.id)}
                  onChange={() => toggleMenuItem(item.id)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-800">{item.name}</span>
              </label>
            ))}
            {menuItems.length === 0 && <p className="text-xs text-gray-500">No menu items. Add items in Menu.</p>}
          </div>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormData((f) => ({ ...f, type: 'PERCENTAGE' }))}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              formData.type === 'PERCENTAGE' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Percentage
          </button>
          <button
            type="button"
            onClick={() => setFormData((f) => ({ ...f, type: 'FIXED_AMOUNT' }))}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              formData.type === 'FIXED_AMOUNT' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Fixed amount
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Value {formData.type === 'PERCENTAGE' ? '(0–100)' : '(Rs.)'}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={formData.value}
          onChange={(e) => setFormData((f) => ({ ...f, value: e.target.value }))}
          placeholder={formData.type === 'PERCENTAGE' ? '20' : '50'}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Min order amount (Rs., optional)</label>
        <p className="text-xs text-gray-500 mb-1">Minimum eligible subtotal (items that match scope) to apply this offer.</p>
        <input
          type="text"
          inputMode="decimal"
          value={formData.minOrderAmount}
          onChange={(e) => setFormData((f) => ({ ...f, minOrderAmount: e.target.value }))}
          placeholder="e.g. 500"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valid from (optional)</label>
          <input
            type="date"
            value={formData.validFrom}
            onChange={(e) => setFormData((f) => ({ ...f, validFrom: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valid to (optional)</label>
          <input
            type="date"
            value={formData.validTo}
            onChange={(e) => setFormData((f) => ({ ...f, validTo: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
          />
        </div>
      </div>
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
