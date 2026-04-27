'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import ImagePicker from '@/components/ui/ImagePicker'
import { menuApi, ApiError } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import Loading from '@/components/ui/Loading'
import { formatCurrency, getItemDisplayImage } from '@/lib/utils'
import { useLocalCollection, refreshLocal, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'

interface MenuItem {
  id: string
  name: string
  price: number
  categoryId: string
  category?: { name: string }
  imageUrl?: string | null
}

interface Category {
  id: string
  name: string
  imageUrl?: string | null
}

export default function MenuItemList() {
  const items = useLocalCollection<MenuItem>('menuItems', menuApi.getItems)
  const categories = useLocalCollection<Category>('menuCategories', menuApi.getCategories)
  const loading = items === undefined || categories === undefined
  const [submitting, setSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [viewingItem, setViewingItem] = useState<MenuItem | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    categoryId: '',
    imageUrl: null as string | null,
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    price: '',
    categoryId: '',
    imageUrl: null as string | null,
  })
  const refreshMenu = async () => {
    await Promise.all([
      refreshLocal('menuItems', menuApi.getItems),
      refreshLocal('menuCategories', menuApi.getCategories),
    ])
  }

  const handleCreateItem = async () => {
    if (!formData.name.trim() || !formData.price || !formData.categoryId) {
      showToast('Please fill all fields', 'error')
      return
    }

    const parsedPrice = parseFloat(formData.price)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      showToast('Price must be a positive number', 'error')
      return
    }

    const payload = {
      name: formData.name.trim(),
      price: parsedPrice,
      categoryId: formData.categoryId,
      imageUrl: formData.imageUrl || undefined,
    }
    await optimisticCreate('menuItems',
      { name: payload.name, price: payload.price, categoryId: payload.categoryId, imageUrl: payload.imageUrl || null },
      () => menuApi.createItem(payload),
      { endpoint: '/menu/item', body: payload }
    )
    setIsModalOpen(false)
    setFormData({ name: '', price: '', categoryId: '', imageUrl: null })
    showToast('Menu item created successfully', 'success')
  }

  const getCategoryName = (categoryId: string) => {
    const category = (categories ?? []).find((c) => c.id === categoryId)
    return category?.name || 'Unknown'
  }

  const handleViewItem = async (id: string) => {
    try {
      const item = await menuApi.getItem(id)
      setViewingItem(item)
      setIsViewModalOpen(true)
    } catch (error: any) {
      showToast(error.message || 'Failed to load item', 'error')
    }
  }

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item)
    setEditFormData({
      name: item.name,
      price: item.price.toString(),
      categoryId: item.categoryId,
      imageUrl: (item as any).imageUrl || null,
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateItem = async () => {
    if (!editingItem || !editFormData.name.trim() || !editFormData.price || !editFormData.categoryId) {
      showToast('Please fill all fields', 'error')
      return
    }

    const parsedPrice = parseFloat(editFormData.price)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      showToast('Price must be a positive number', 'error')
      return
    }

    const payload = {
      name: editFormData.name.trim(),
      price: parsedPrice,
      categoryId: editFormData.categoryId,
      imageUrl: editFormData.imageUrl || undefined,
    }
    await optimisticUpdate('menuItems', editingItem.id,
      payload,
      () => menuApi.updateItem(editingItem.id, payload),
      { endpoint: `/menu/item/${editingItem.id}`, body: payload }
    )
    setIsEditModalOpen(false)
    setEditingItem(null)
    setEditFormData({ name: '', price: '', categoryId: '', imageUrl: null })
    showToast('Menu item updated successfully', 'success')
  }

  const handleDeleteItem = async (id: string) => {
    const ok = await appConfirm({
      title: 'Delete menu item',
      message: 'Are you sure you want to delete this menu item? This will hide it from the menu.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('menuItems', id,
      () => menuApi.deleteItem(id),
      { endpoint: `/menu/item/${id}` }
    )
    showToast('Menu item deleted', 'success')
  }

  if (loading) {
    return <Loading />
  }

  return (
    <>
      <div className="space-y-4">
        {(items ?? []).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-700 font-medium">No menu items found.</p>
            <p className="text-gray-600 mt-1">Create your first item!</p>
          </div>
        ) : (
          (items ?? []).map((item) => {
            const category = (categories ?? []).find((c) => c.id === item.categoryId)
            const imageUrl = getItemDisplayImage(item, category)
            return (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow flex gap-4">
                {imageUrl ? (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                    No img
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Category: {getCategoryName(item.categoryId)}
                  </p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(item.price)}</p>
                  <div className="mt-2 flex gap-3 text-red-700">
                    <button
                      onClick={() => handleViewItem(item.id)}
                      className="text-blue-700 hover:text-blue-800"
                      title="View"
                    >
                      👁
                    </button>
                    <button
                      onClick={() => handleEditItem(item)}
                      className="hover:text-red-800"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="hover:text-red-800"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}

        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-20 right-4 bg-red-700 text-white px-5 py-3 rounded-full shadow-lg hover:bg-red-800 transition"
        >
          + Item
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setFormData({ name: '', price: '', categoryId: '', imageUrl: null })
        }}
        title="Create Menu Item"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Ice Tea"
              className="w-full px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            >
              <option value="">Select a category</option>
              {(categories ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <ImagePicker
              label="Item Image"
              value={formData.imageUrl}
              onChange={(imageUrl) => setFormData({ ...formData, imageUrl })}
              compact
            />
          </div>

          <button
            onClick={handleCreateItem}
            disabled={submitting}
            className="w-full bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? 'Creating...' : 'Create Item'}
          </button>
        </div>
      </Modal>

      {/* Edit Menu Item Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingItem(null)
          setEditFormData({ name: '', price: '', categoryId: '', imageUrl: null })
        }}
        title="Edit Menu Item"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              placeholder="e.g., Ice Tea"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={editFormData.price}
              onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category<span className="text-red-600">*</span>
            </label>
            <select
              value={editFormData.categoryId}
              onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            >
              <option value="">Select a category</option>
              {(categories ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <ImagePicker
              label="Item Image"
              value={editFormData.imageUrl}
              onChange={(imageUrl) => setEditFormData({ ...editFormData, imageUrl })}
              compact
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingItem(null)
                setEditFormData({ name: '', price: '', categoryId: '', imageUrl: null })
              }}
              className="flex-1 border border-red-700 text-red-700 py-2 rounded-lg font-medium hover:bg-red-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateItem}
              className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition"
            >
              Update
            </button>
          </div>
        </div>
      </Modal>

      {/* View Menu Item Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingItem(null)
        }}
        title="Menu Item Details"
      >
        {viewingItem && (() => {
          const item = viewingItem
          return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
              <p className="text-gray-900 font-semibold">{item.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <p className="text-gray-900 font-semibold">{formatCurrency(item.price)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <p className="text-gray-600">{getCategoryName(item.categoryId)}</p>
            </div>
            {item.imageUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false)
                  handleEditItem(item)
                }}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false)
                  setViewingItem(null)
                }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          </div>
          )
        })()}
      </Modal>
    </>
  )
}
