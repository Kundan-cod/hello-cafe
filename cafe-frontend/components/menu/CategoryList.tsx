'use client'

import { useState } from 'react'
import CategoryCard from './CategoryCard'
import Modal from '@/components/ui/Modal'
import ImagePicker from '@/components/ui/ImagePicker'
import { menuApi } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import Loading from '@/components/ui/Loading'
import { formatCurrency } from '@/lib/utils'
import { useLocalCollection, refreshLocal, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'

interface Category {
  id: string
  name: string
  items: Array<{ id: string; name: string; price: number }>
  imageUrl?: string | null
}

interface ItemInput {
  name: string
  price: string
  imageUrl: string | null
}

export default function CategoryList() {
  const categories = useLocalCollection<Category>('menuCategories', menuApi.getCategories)
  const loading = categories === undefined
  const [submitting, setSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [viewingCategory, setViewingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryImageUrl, setCategoryImageUrl] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryImageUrl, setEditCategoryImageUrl] = useState<string | null>(null)
  const [items, setItems] = useState<ItemInput[]>([
    { name: '', price: '', imageUrl: null },
  ])

  const handleAddItem = () => {
    setItems([...items, { name: '', price: '', imageUrl: null }])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    } else {
      showToast('At least one item is required', 'error')
    }
  }

  const handleItemChange = (
    index: number,
    field: 'name' | 'price',
    value: string
  ) => {
    const updatedItems = [...items]
    updatedItems[index][field] = value
    setItems(updatedItems)
  }

  const handleItemImageUrlChange = (index: number, url: string | null) => {
    const updatedItems = [...items]
    updatedItems[index].imageUrl = url
    setItems(updatedItems)
  }

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      showToast('Category name is required', 'error')
      return
    }

    const validItems = items.filter((item) => item.name.trim() && item.price.trim())
    if (validItems.length === 0) {
      showToast('At least one item with name and price is required', 'error')
      return
    }

    const invalidPrice = validItems.find((item) => {
      const parsed = parseFloat(item.price)
      return !Number.isFinite(parsed) || parsed <= 0
    })

    if (invalidPrice) {
      showToast('Each item price must be a positive number', 'error')
      return
    }

    try {
      setSubmitting(true)
      const categoryData = await menuApi.createCategory({
        name: categoryName.trim(),
        imageUrl: categoryImageUrl || undefined,
      })

      for (const item of validItems) {
        await menuApi.createItem({
          name: item.name.trim(),
          price: parseFloat(item.price),
          categoryId: categoryData.id,
          imageUrl: item.imageUrl || undefined,
        })
      }

      await Promise.all([
        refreshLocal('menuCategories', menuApi.getCategories),
        refreshLocal('menuItems', menuApi.getItems),
      ])
      showToast('Category and items created successfully', 'success')
      setIsModalOpen(false)
      setCategoryName('')
      setCategoryImageUrl(null)
      setItems([{ name: '', price: '', imageUrl: null }])
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Failed to create category', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    setCategoryName('')
    setCategoryImageUrl(null)
    setItems([{ name: '', price: '', imageUrl: null }])
  }

  const handleViewCategory = async (id: string) => {
    try {
      const category = await menuApi.getCategory(id)
      if (category) {
        setViewingCategory(category)
        setIsViewModalOpen(true)
      } else {
        showToast('Category not found', 'error')
      }
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Failed to load category', 'error')
    }
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setEditCategoryName(category.name)
    setEditCategoryImageUrl(category.imageUrl || null)
    setIsEditModalOpen(true)
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) {
      showToast('Category name is required', 'error')
      return
    }

    const payload = { name: editCategoryName.trim(), imageUrl: editCategoryImageUrl || undefined }
    await optimisticUpdate('menuCategories', editingCategory.id,
      payload,
      () => menuApi.updateCategory(editingCategory.id, payload),
      { endpoint: `/menu/category/${editingCategory.id}`, body: payload }
    )
    setIsEditModalOpen(false)
    setEditingCategory(null)
    showToast('Category updated successfully', 'success')
  }

  const handleDeleteCategory = async (id: string) => {
    const ok = await appConfirm({
      title: 'Hide category',
      message:
        'Are you sure you want to hide this category? It and its items will be removed from billing.',
      confirmText: 'Hide',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('menuCategories', id,
      () => menuApi.deleteCategory(id),
      { endpoint: `/menu/category/${id}` }
    )
    showToast('Category deleted', 'success')
  }

  if (loading) {
    return <Loading />
  }

  return (
    <>
      <div className="space-y-4">
        {(categories ?? []).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-700 font-medium">No categories found.</p>
            <p className="text-gray-600 mt-1">Create your first category!</p>
          </div>
        ) : (
          (categories ?? []).map((cat) => (
            <CategoryCard
              key={cat.id}
              category={{
                id: cat.id,
                name: cat.name,
                total: cat.items?.length || 0,
                imageUrl: cat.imageUrl || null,
              }}
              onView={() => handleViewCategory(cat.id)}
              onEdit={() => handleEditCategory(cat)}
              onDelete={() => handleDeleteCategory(cat.id)}
            />
          ))
        )}

        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-20 right-4 bg-red-700 text-white px-5 py-3 rounded-full shadow-lg hover:bg-red-800 transition"
        >
          + Category
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCancel}
        title="Add New Category"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Enter the category name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>

          <div>
            <ImagePicker
              label="Category Image"
              value={categoryImageUrl}
              onChange={setCategoryImageUrl}
            />
          </div>

          {items.map((item, index) => (
            <div key={index} className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Item {index + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name<span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                  placeholder="Enter the item name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Price<span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.price}
                  onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                  placeholder="Enter the price"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                />
              </div>

              <div>
                <ImagePicker
                  label="Item Image"
                  value={item.imageUrl}
                  onChange={(url) => handleItemImageUrlChange(index, url)}
                  compact
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full border-2 border-red-700 text-red-700 py-2 rounded-lg font-medium hover:bg-red-50 transition"
          >
            Add Item
          </button>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 border border-red-700 text-red-700 py-2 rounded-lg font-medium hover:bg-red-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={submitting}
              className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingCategory(null)
          setEditCategoryName('')
          setEditCategoryImageUrl(null)
        }}
        title="Edit Category"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              placeholder="Enter the category name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          <div>
            <ImagePicker
              label="Category Image"
              value={editCategoryImageUrl}
              onChange={setEditCategoryImageUrl}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingCategory(null)
                setEditCategoryName('')
                setEditCategoryImageUrl(null)
              }}
              className="flex-1 border border-red-700 text-red-700 py-2 rounded-lg font-medium hover:bg-red-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateCategory}
              className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition"
            >
              Update
            </button>
          </div>
        </div>
      </Modal>

      {/* View Category Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingCategory(null)
        }}
        title="Category Details"
      >
        {viewingCategory && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
              <p className="text-gray-900 font-semibold">{viewingCategory.name}</p>
            </div>
            {viewingCategory.imageUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <img
                  src={viewingCategory.imageUrl}
                  alt={viewingCategory.name}
                  className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Items</label>
              <p className="text-gray-600">{viewingCategory.items?.length || 0} items</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false)
                  handleEditCategory(viewingCategory)
                }}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false)
                  setViewingCategory(null)
                }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
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
