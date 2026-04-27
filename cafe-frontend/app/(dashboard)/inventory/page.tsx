'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import { inventoryApi, menuApi } from '@/lib/api'
import { useLocalCollection, refreshLocal, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'

interface InventoryProduct {
  id: string
  name: string
  unit: string
  currentQuantity: number
  usages?: { menuItem: { id: string; name: string }; quantityPerUnit: number }[]
}

interface StockHistoryEntry {
  id: string
  quantityChange: number
  type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT'
  referenceId?: string | null
  note?: string | null
  createdAt: string
}

interface MenuItem {
  id: string
  name: string
  categoryId: string
}

const emptyProductForm = { name: '', unit: '' }
const emptyStockForm = { quantity: '', note: '' }

export default function InventoryPage() {
  const products = useLocalCollection<InventoryProduct>('inventoryProducts', inventoryApi.getProducts)
  const menuItems = useLocalCollection<MenuItem>('menuItems', menuApi.getItems)
  const loading = products === undefined || menuItems === undefined
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [submitting, setSubmitting] = useState(false)
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null)
  const [editForm, setEditForm] = useState(emptyProductForm)
  const [stockModal, setStockModal] = useState<InventoryProduct | null>(null)
  const [stockForm, setStockForm] = useState(emptyStockForm)
  const [stockSubmitting, setStockSubmitting] = useState(false)
  const [historyModal, setHistoryModal] = useState<InventoryProduct | null>(null)
  const [history, setHistory] = useState<StockHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [linkModal, setLinkModal] = useState<InventoryProduct | null>(null)
  const [linkForm, setLinkForm] = useState<
    { menuItemId: string; quantityPerUnit: string }[]
  >([])
  const [linkSubmitting, setLinkSubmitting] = useState(false)

  const handleCreateProduct = async () => {
    if (!productForm.name.trim() || !productForm.unit.trim()) {
      showToast('Name and unit are required', 'error')
      return
    }
    const payload = {
      name: productForm.name.trim(),
      unit: productForm.unit.trim(),
    }
    await optimisticCreate('inventoryProducts', payload, () => inventoryApi.createProduct(payload), { endpoint: '/inventory', body: payload })
    showToast('Product added', 'success')
    setIsAddOpen(false)
    setProductForm(emptyProductForm)
  }

  const handleUpdateProduct = async () => {
    if (!editingProduct) return
    if (!editForm.name.trim() || !editForm.unit.trim()) {
      showToast('Name and unit are required', 'error')
      return
    }
    const payload = {
      name: editForm.name.trim(),
      unit: editForm.unit.trim(),
    }
    await optimisticUpdate('inventoryProducts', editingProduct.id, payload, () => inventoryApi.updateProduct(editingProduct.id, payload), { endpoint: `/inventory/${editingProduct.id}`, body: payload })
    showToast('Product updated', 'success')
    setEditingProduct(null)
    setEditForm(emptyProductForm)
  }

  const handleDeleteProduct = async (id: string) => {
    const ok = await appConfirm({
      title: 'Remove product',
      message: 'Remove this product from inventory? Links to menu items will be removed.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('inventoryProducts', id, () => inventoryApi.deleteProduct(id), { endpoint: `/inventory/${id}` })
    showToast('Product removed', 'success')
  }

  const openStock = (p: InventoryProduct) => {
    setStockModal(p)
    setStockForm(emptyStockForm)
  }

  const handleAddStock = async () => {
    if (!stockModal) return
    const qty = parseFloat(stockForm.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('Enter a valid positive quantity', 'error')
      return
    }
    try {
      setStockSubmitting(true)
      await inventoryApi.addStock(stockModal.id, {
        quantity: qty,
        note: stockForm.note.trim() || undefined,
      })
      await refreshLocal('inventoryProducts', inventoryApi.getProducts)
      showToast('Stock added', 'success')
      setStockModal(null)
      setStockForm(emptyStockForm)
    } catch (error: any) {
      showToast(error.message || 'Failed to add stock', 'error')
    } finally {
      setStockSubmitting(false)
    }
  }

  const openHistory = async (p: InventoryProduct) => {
    setHistoryModal(p)
    setHistoryLoading(true)
    setHistory([])
    try {
      const data = await inventoryApi.getStockHistory(p.id)
      setHistory(data)
    } catch (error: any) {
      showToast(error.message || 'Failed to load history', 'error')
      setHistoryModal(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  const openLink = (p: InventoryProduct) => {
    setLinkModal(p)
    const existing = (p.usages || []).map((u) => ({
      menuItemId: u.menuItem.id,
      quantityPerUnit: String(u.quantityPerUnit),
    }))
    setLinkForm(
      existing.length > 0
        ? existing
        : [{ menuItemId: '', quantityPerUnit: '' }]
    )
  }

  const addLinkRow = () => {
    setLinkForm((f) => [...f, { menuItemId: '', quantityPerUnit: '' }])
  }

  const removeLinkRow = (index: number) => {
    setLinkForm((f) => f.filter((_, i) => i !== index))
  }

  const updateLinkRow = (
    index: number,
    field: 'menuItemId' | 'quantityPerUnit',
    value: string
  ) => {
    setLinkForm((f) =>
      f.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const handleSaveLinks = async () => {
    if (!linkModal) return
    const links = linkForm
      .filter((r) => r.menuItemId && parseFloat(r.quantityPerUnit) > 0)
      .map((r) => ({
        menuItemId: r.menuItemId,
        quantityPerUnit: parseFloat(r.quantityPerUnit),
      }))
    const uniqueByMenu = links.reduce(
      (acc, u) => {
        acc[u.menuItemId] = u
        return acc
      },
      {} as Record<string, { menuItemId: string; quantityPerUnit: number }>
    )
    const list = Object.values(uniqueByMenu)
    if (list.length === 0) {
      showToast('Add at least one menu item with quantity per unit', 'error')
      return
    }
    try {
      setLinkSubmitting(true)
      await inventoryApi.setProductMenuLinks(linkModal.id, list)
      await refreshLocal('inventoryProducts', inventoryApi.getProducts)
      showToast('Links updated', 'success')
      setLinkModal(null)
    } catch (error: any) {
      showToast(error.message || 'Failed to save links', 'error')
    } finally {
      setLinkSubmitting(false)
    }
  }

  const typeLabel = (t: string) =>
    t === 'PURCHASE' ? 'Purchase' : t === 'SALE' ? 'Sale' : 'Adjustment'

  if (loading) return <Loading />

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory</h1>
        <button
          type="button"
          onClick={() => {
            setProductForm(emptyProductForm)
            setIsAddOpen(true)
          }}
          className="w-full sm:w-auto min-h-[44px] bg-red-700 text-white px-4 py-2.5 rounded-lg hover:bg-red-800 font-medium"
        >
          + Add Product
        </button>
      </div>

      <p className="text-gray-600 text-sm mb-4">
        Link products to menu items so that when an order is completed, stock is deducted automatically. Add stock manually or via vendor purchases.
      </p>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">Product</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">Unit</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">Quantity</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">Linked menu</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900 w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(products ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No inventory products yet. Add one and link it to menu items.
                  </td>
                </tr>
              ) : (
                (products ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          p.currentQuantity <= 0
                            ? 'text-red-600 font-semibold'
                            : 'text-gray-900'
                        }
                      >
                        {p.currentQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(p.usages || []).length === 0
                        ? '—'
                        : (p.usages || [])
                            .map((u) => `${u.menuItem.name} (${u.quantityPerUnit}/${p.unit})`)
                            .join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openStock(p)}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          Add stock
                        </button>
                        <button
                          type="button"
                          onClick={() => openHistory(p)}
                          className="text-sm font-medium text-gray-600 hover:underline"
                        >
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() => openLink(p)}
                          className="text-sm font-medium text-gray-600 hover:underline"
                        >
                          Link menu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(p)
                            setEditForm({ name: p.name, unit: p.unit })
                          }}
                          className="text-gray-500 hover:text-gray-700"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
                          className="text-gray-500 hover:text-red-600"
                          title="Remove"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Product">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={productForm.name}
              onChange={(e) =>
                setProductForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Coffee beans"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
            <input
              type="text"
              value={productForm.unit}
              onChange={(e) =>
                setProductForm((f) => ({ ...f, unit: e.target.value }))
              }
              placeholder="e.g. kg, L, pcs"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="flex-1 border border-gray-400 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-100 bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateProduct}
              disabled={submitting}
              className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => {
          setEditingProduct(null)
          setEditForm(emptyProductForm)
        }}
        title="Edit Product"
      >
        {editingProduct && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <input
                type="text"
                value={editForm.unit}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, unit: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null)
                  setEditForm(emptyProductForm)
                }}
                className="flex-1 border border-gray-400 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-100 bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateProduct}
                disabled={submitting}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Stock Modal */}
      <Modal
        isOpen={!!stockModal}
        onClose={() => {
          setStockModal(null)
          setStockForm(emptyStockForm)
        }}
        title={stockModal ? `Add stock – ${stockModal.name}` : ''}
      >
        {stockModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Current: {stockModal.currentQuantity} {stockModal.unit}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity to add *
              </label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={stockForm.quantity}
                onChange={(e) =>
                  setStockForm((f) => ({ ...f, quantity: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <input
                type="text"
                value={stockForm.note}
                onChange={(e) =>
                  setStockForm((f) => ({ ...f, note: e.target.value }))
                }
                placeholder="e.g. Restock"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStockModal(null)
                  setStockForm(emptyStockForm)
                }}
                className="flex-1 border border-gray-400 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-100 bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddStock}
                disabled={stockSubmitting}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
              >
                {stockSubmitting ? 'Saving...' : 'Add stock'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={!!historyModal}
        onClose={() => setHistoryModal(null)}
        title={historyModal ? `Stock history – ${historyModal.name}` : ''}
      >
        {historyModal && (
          <div className="space-y-4">
            {historyLoading ? (
              <p className="text-center text-gray-500 py-4">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No history yet.</p>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Change</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 text-gray-800">
                          {new Date(h.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-900 font-medium">
                          {typeLabel(h.type)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            h.quantityChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {h.quantityChange >= 0 ? '+' : ''}
                          {h.quantityChange}
                        </td>
                        <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate">
                          {h.note || '—'}
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
                className="px-4 py-2 border border-gray-400 text-gray-800 rounded-lg font-medium hover:bg-gray-100 bg-white"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Link to menu Modal */}
      <Modal
        isOpen={!!linkModal}
        onClose={() => setLinkModal(null)}
        title={linkModal ? `Link to menu – ${linkModal.name}` : ''}
      >
        {linkModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              For each menu item, set how much of this product ({linkModal.unit}) is used per 1
              unit of that item. When the item is sold, inventory is reduced automatically.
            </p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {linkForm.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center border border-gray-200 p-2 rounded">
                  <select
                    value={row.menuItemId}
                    onChange={(e) => updateLinkRow(idx, 'menuItemId', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                  >
                    <option value="">Select menu item</option>
                    {(menuItems ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    placeholder="Qty per unit"
                    value={row.quantityPerUnit}
                    onChange={(e) =>
                      updateLinkRow(idx, 'quantityPerUnit', e.target.value)
                    }
                    className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeLinkRow(idx)}
                    className="p-1.5 text-gray-500 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLinkRow}
              className="text-sm text-red-700 font-medium"
            >
              + Add menu item link
            </button>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLinkModal(null)}
                className="flex-1 border border-gray-400 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-100 bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLinks}
                disabled={linkSubmitting}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
              >
                {linkSubmitting ? 'Saving...' : 'Save links'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
