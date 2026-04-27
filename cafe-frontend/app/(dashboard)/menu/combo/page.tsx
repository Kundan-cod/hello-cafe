
'use client'

import { useMemo, useState } from 'react'
import { combosApi } from '@/lib/api'
import { useLocalCollection, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import Modal from '@/components/ui/Modal'
import ImagePicker from '@/components/ui/ImagePicker'
import Loading from '@/components/ui/Loading'
import { formatCurrency } from '@/lib/utils'

interface ComboItemInput {
  name: string
  // Optional link to a menu item; currently unused in UI but kept for future alignment.
  menuItemId?: string
}

interface Combo {
  id: string
  name: string
  price: number
  description?: string | null
  imageUrl?: string | null
  items?: Array<{ name: string; menuItemId?: string | null }>
}

export default function ComboPage() {
  const combos = useLocalCollection<Combo>('combos', combosApi.getCombos)
  const loading = combos === undefined
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
  const [viewingCombo, setViewingCombo] = useState<Combo | null>(null)

  const [search, setSearch] = useState('')

  const [comboName, setComboName] = useState('')
  const [comboPrice, setComboPrice] = useState('')
  const [comboDescription, setComboDescription] = useState('')
  const [comboImageUrl, setComboImageUrl] = useState<string | null>(null)
  const [items, setItems] = useState<ComboItemInput[]>([{ name: '' }])

  const [editComboName, setEditComboName] = useState('')
  const [editComboPrice, setEditComboPrice] = useState('')
  const [editComboDescription, setEditComboDescription] = useState('')
  const [editComboImageUrl, setEditComboImageUrl] = useState<string | null>(null)
  const [editItems, setEditItems] = useState<ComboItemInput[]>([{ name: '' }])

  const filteredCombos = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return combos ?? []
    return (combos ?? []).filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(term)
      const descriptionMatch = (c.description ?? '').toLowerCase().includes(term)
      return nameMatch || descriptionMatch
    })
  }, [combos, search])

  const resetCreateForm = () => {
    setComboName('')
    setComboPrice('')
    setComboDescription('')
    setComboImageUrl(null)
    setItems([{ name: '' }])
  }

  const resetEditForm = () => {
    setEditingCombo(null)
    setEditComboName('')
    setEditComboPrice('')
    setEditComboDescription('')
    setEditComboImageUrl(null)
    setEditItems([{ name: '' }])
  }

  const handleAddItem = () => {
    setItems([...items, { name: '' }])
  }

  const handleItemChange = (index: number, value: string) => {
    const updated = [...items]
    updated[index].name = value
    setItems(updated)
  }

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const handleCreateCombo = async () => {
    if (!comboName.trim()) {
      showToast('Combo name is required', 'error')
      return
    }
    const parsedPrice = parseFloat(comboPrice)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      showToast('Combo price must be a positive number', 'error')
      return
    }
    const validItems = items.filter((i) => i.name.trim())
    if (validItems.length === 0) {
      showToast('Add at least one item to the combo', 'error')
      return
    }

    const payload = {
      name: comboName.trim(),
      price: parsedPrice,
      description: comboDescription.trim() || undefined,
      imageUrl: comboImageUrl || undefined,
      items: validItems.length ? validItems : undefined,
    }
    await optimisticCreate('combos',
      { name: payload.name, price: payload.price, description: payload.description, items: payload.items, imageUrl: payload.imageUrl },
      () => combosApi.createCombo(payload),
      { endpoint: '/combos', body: payload }
    )
    showToast('Combo created successfully', 'success')
    setIsModalOpen(false)
    resetCreateForm()
  }

  const openEditCombo = (combo: Combo) => {
    setEditingCombo(combo)
    setEditComboName(combo.name)
    setEditComboPrice(combo.price.toString())
    setEditComboDescription(combo.description || '')
    setEditComboImageUrl(combo.imageUrl || null)
    const parsedItems =
      (combo.items as Array<{ name: string }> | undefined)?.map((i) => ({ name: i.name })) ||
      [{ name: '' }]
    setEditItems(parsedItems.length ? parsedItems : [{ name: '' }])
    setIsEditModalOpen(true)
  }

  const handleUpdateCombo = async () => {
    if (!editingCombo) return
    if (!editComboName.trim()) {
      showToast('Combo name is required', 'error')
      return
    }
    const parsedPrice = parseFloat(editComboPrice)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      showToast('Combo price must be a positive number', 'error')
      return
    }
    const validItems = editItems.filter((i) => i.name.trim())
    if (validItems.length === 0) {
      showToast('Add at least one item to the combo', 'error')
      return
    }

    const payload = {
      name: editComboName.trim(),
      price: parsedPrice,
      description: editComboDescription.trim() || undefined,
      imageUrl: editComboImageUrl || undefined,
      items: validItems.length ? validItems : undefined,
    }
    await optimisticUpdate('combos', editingCombo.id,
      payload,
      () => combosApi.updateCombo(editingCombo.id, payload),
      { endpoint: `/combos/${editingCombo.id}`, body: payload }
    )
    showToast('Combo updated successfully', 'success')
    setIsEditModalOpen(false)
    resetEditForm()
  }

  const handleDeleteCombo = async (id: string) => {
    const ok = await appConfirm({
      title: 'Delete combo',
      message: 'Are you sure you want to delete this combo?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('combos', id,
      () => combosApi.deleteCombo(id),
      { endpoint: `/combos/${id}` }
    )
    showToast('Combo deleted', 'success')
  }

  if (loading) {
    return <Loading />
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Combo Items List</h1>
          <button
            type="button"
            onClick={() => {
              resetCreateForm()
              setIsModalOpen(true)
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            + Combo
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm text-gray-600 placeholder:text-gray-600 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
          />
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-gray-400">
            🔍
          </span>
        </div>

        {filteredCombos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="mb-4 text-5xl">🔍</div>
            <p className="text-sm font-medium">No combo items available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCombos.map((combo) => (
              <div
                key={combo.id}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {combo.imageUrl ? (
                      <img
                        src={combo.imageUrl}
                        alt={combo.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        No img
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{combo.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {combo.description || 'No description'}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatCurrency(combo.price)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-red-700">
                  <button
                    type="button"
                    onClick={() => setViewingCombo(combo)}
                    className="text-blue-700 hover:text-blue-800"
                    title="View"
                  >
                    👁
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditCombo(combo)}
                    className="hover:text-red-800"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCombo(combo.id)}
                    className="hover:text-red-800"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Combo Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          resetCreateForm()
        }}
        title="Add New Combo"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Combo Name<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              placeholder="Enter the combo name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-600 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name<span className="text-red-600">*</span>
            </label>
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  placeholder="Enter the item name"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-600 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-xs text-red-700 hover:text-red-900"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-1 rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Add Item
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={comboPrice}
              onChange={(e) => setComboPrice(e.target.value)}
              placeholder="Enter the price of item"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-600 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Combo Description (Optional)
            </label>
            <textarea
              value={comboDescription}
              onChange={(e) => setComboDescription(e.target.value)}
              placeholder="Enter the combo description"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-600 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
            />
          </div>

          <div>
            <ImagePicker
              label="Combo Image"
              value={comboImageUrl}
              onChange={setComboImageUrl}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false)
                resetCreateForm()
              }}
              className="flex-1 rounded-lg border border-red-700 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateCombo}
              className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Add
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Combo Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          resetEditForm()
        }}
        title="Edit Combo"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Combo Name<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={editComboName}
              onChange={(e) => setEditComboName(e.target.value)}
              placeholder="Enter the combo name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-600 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={editComboPrice}
              onChange={(e) => setEditComboPrice(e.target.value)}
              placeholder="Enter the price of item"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-600 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Combo Description (Optional)
            </label>
            <textarea
              value={editComboDescription}
              onChange={(e) => setEditComboDescription(e.target.value)}
              placeholder="Enter the combo description"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-600 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
            />
          </div>

          <div>
            <ImagePicker
              label="Combo Image"
              value={editComboImageUrl}
              onChange={setEditComboImageUrl}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false)
                resetEditForm()
              }}
              className="flex-1 rounded-lg border border-red-700 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateCombo}
              className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* View Combo Modal */}
      <Modal
        isOpen={!!viewingCombo}
        onClose={() => setViewingCombo(null)}
        title="Combo Details"
      >
        {viewingCombo && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <p className="text-gray-900 font-semibold">{viewingCombo.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <p className="text-gray-900 font-semibold">{formatCurrency(viewingCombo.price)}</p>
            </div>
            {viewingCombo.description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-gray-700 text-sm">{viewingCombo.description}</p>
              </div>
            )}
            {viewingCombo.imageUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <img
                  src={viewingCombo.imageUrl}
                  alt={viewingCombo.name}
                  className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Items</label>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {Array.isArray(viewingCombo.items) && viewingCombo.items.length > 0 ? (
                  viewingCombo.items.map((i: { name: string; menuItemId?: string | null }, idx: number) => (
                    <li key={`${i.menuItemId ?? i.name}-${idx}`}>{i.name}</li>
                  ))
                ) : (
                  <li>No items listed</li>
                )}
              </ul>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (viewingCombo) {
                    openEditCombo(viewingCombo)
                  }
                  setViewingCombo(null)
                }}
                className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setViewingCombo(null)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}