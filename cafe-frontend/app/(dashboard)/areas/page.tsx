'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import { areasApi, tablesApi } from '@/lib/api'
import { useLocalCollection, refreshLocal, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'

interface Area {
  id: string
  name: string
  description?: string | null
}

interface TableInput {
  name: string
  description: string
}

export default function AreasPage() {
  const areas = useLocalCollection<Area>('areas', areasApi.getAreas)
  const loading = areas === undefined
  const [submitting, setSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [viewingArea, setViewingArea] = useState<Area | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
  })
  const [tables, setTables] = useState<TableInput[]>([
    { name: '', description: '' }, // Start with one table field
  ])
  const handleAddTable = () => {
    setTables([...tables, { name: '', description: '' }])
  }

  const handleRemoveTable = (index: number) => {
    if (tables.length > 1) {
      setTables(tables.filter((_, i) => i !== index))
    } else {
      showToast('At least one table is required', 'error')
    }
  }

  const handleTableChange = (index: number, field: 'name' | 'description', value: string) => {
    const updatedTables = [...tables]
    updatedTables[index][field] = value
    setTables(updatedTables)
  }

  const handleCreateArea = async () => {
    if (!formData.name.trim()) {
      showToast('Area name is required', 'error')
      return
    }

    const validTables = tables.filter((table) => table.name.trim())
    if (validTables.length === 0) {
      showToast('At least one table with a name is required', 'error')
      return
    }

    const areaPayload = { name: formData.name.trim(), description: formData.description.trim() || undefined }
    await optimisticCreate('areas',
      { ...areaPayload, createdAt: new Date().toISOString() },
      async () => {
        const area = await areasApi.createArea(areaPayload)
        if (area?.id) {
          for (const table of validTables) {
            await tablesApi.createTable({
              code: table.name.trim(),
              areaId: area.id,
              capacity: 4,
            })
          }
        }
        return area
      },
      { endpoint: '/areas', body: areaPayload }
    )
    showToast('Area and tables created successfully', 'success')
    setIsModalOpen(false)
    setFormData({ name: '', description: '' })
    setTables([{ name: '', description: '' }])
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    setFormData({ name: '', description: '' })
    setTables([{ name: '', description: '' }])
  }

  const handleViewArea = async (id: string) => {
    try {
      const area = await areasApi.getArea(id)
      setViewingArea(area)
      setIsViewModalOpen(true)
    } catch (error: any) {
      showToast(error.message || 'Failed to load area', 'error')
    }
  }

  const handleEditArea = (area: Area) => {
    setEditingArea(area)
    setEditFormData({
      name: area.name,
      description: area.description || '',
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateArea = async () => {
    if (!editingArea || !editFormData.name.trim()) {
      showToast('Area name is required', 'error')
      return
    }

    const payload = {
      name: editFormData.name.trim(),
      description: editFormData.description.trim() || undefined,
    }
    await optimisticUpdate('areas', editingArea.id,
      payload,
      () => areasApi.updateArea(editingArea.id, payload),
      { endpoint: `/areas/${editingArea.id}`, body: payload }
    )
    showToast('Area updated successfully', 'success')
    setIsEditModalOpen(false)
    setEditingArea(null)
  }

  const handleDeleteArea = async (id: string) => {
    const ok = await appConfirm({
      title: 'Delete area',
      message: 'Are you sure you want to delete this area? This will hide it from the list.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('areas', id,
      () => areasApi.deleteArea(id),
      { endpoint: `/areas/${id}` }
    )
    showToast('Area deleted', 'success')
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manage Areas</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto min-h-[44px] bg-red-700 text-white px-4 py-2.5 rounded-lg hover:bg-red-800 active:bg-red-900 font-medium"
        >
          + Add Area
        </button>
      </div>

      {(areas ?? []).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-700 font-medium mb-2">No areas found</p>
          <p className="text-gray-600">Create your first area to organize tables</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {(areas ?? []).map((area) => (
            <div
              key={area.id}
              className="bg-white rounded-xl p-4 sm:p-6 shadow hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg sm:text-xl text-gray-900 mb-1">{area.name}</h3>
                  <p className="text-sm text-gray-600">
                    {area.description || 'No description'}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleViewArea(area.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-700 hover:bg-blue-50 rounded-lg active:bg-blue-100"
                    title="View"
                  >
                    👁
                  </button>
                  <button
                    onClick={() => handleEditArea(area)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-700 hover:bg-red-50 rounded-lg active:bg-red-100"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteArea(area.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-700 hover:bg-red-50 rounded-lg active:bg-red-100"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Tip: Add tables under this area from “Manage Tables”.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCancel}
        title="Add New Area"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area Name<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter the area name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>

          {tables.map((table, index) => (
            <div key={index} className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Table {index + 1}
                </span>
                {tables.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTable(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Table Name<span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={table.name}
                  onChange={(e) => handleTableChange(index, 'name', e.target.value)}
                  placeholder="Enter the table name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={table.description}
                  onChange={(e) => handleTableChange(index, 'description', e.target.value)}
                  placeholder="Enter the description"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddTable}
            className="w-full border-2 border-red-700 text-red-700 py-2 rounded-lg font-medium hover:bg-red-50 transition"
          >
            Add New Table
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
              onClick={handleCreateArea}
              disabled={submitting}
              className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              Add
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Area Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingArea(null)
          setEditFormData({ name: '', description: '' })
        }}
        title="Edit Area"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area Name<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              placeholder="Enter the area name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={editFormData.description}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              placeholder="Enter the description"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingArea(null)
                setEditFormData({ name: '', description: '' })
              }}
              className="flex-1 border border-red-700 text-red-700 py-2 rounded-lg font-medium hover:bg-red-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateArea}
              disabled={submitting}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? 'Updating...' : 'Update'} 
            </button>
          </div>
        </div>
      </Modal>

      {/* View Area Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingArea(null)
        }}
        title="Area Details"
      >
        {viewingArea && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area Name</label>
              <p className="text-gray-900 font-semibold">{viewingArea.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p className="text-gray-600">{viewingArea.description || 'No description'}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false)
                  handleEditArea(viewingArea)
                }}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false)
                  setViewingArea(null)
                }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
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
