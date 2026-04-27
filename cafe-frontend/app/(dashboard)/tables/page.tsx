'use client'

import { useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import { areasApi, tablesApi } from '@/lib/api'
import { useLocalCollection, refreshLocal, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'

interface Area {
  id: string
  name: string
}

interface Table {
  id: string
  code: string
  capacity: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'
  areaId: string
  area?: { id: string; name: string }
}

export default function TablesPage() {
  const areas = useLocalCollection<Area>('areas', areasApi.getAreas)
  const tables = useLocalCollection<Table>('dineTables', tablesApi.getTables)
  const loading = areas === undefined || tables === undefined
  const [submitting, setSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [viewingTable, setViewingTable] = useState<Table | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    areaId: '',
    capacity: '',
  })
  const [editFormData, setEditFormData] = useState({
    code: '',
    areaId: '',
    capacity: '',
    status: 'AVAILABLE' as 'AVAILABLE' | 'OCCUPIED' | 'RESERVED',
  })
  const refreshAll = async () => {
    await Promise.all([refreshLocal('areas', areasApi.getAreas), refreshLocal('dineTables', tablesApi.getTables)])
  }

  const handleCreateTable = async () => {
    if (!formData.code.trim() || !formData.areaId || !formData.capacity) {
      showToast('Please fill all fields', 'error')
      return
    }

    const payload = {
      code: formData.code.trim(),
      areaId: formData.areaId,
      capacity: Number(formData.capacity),
    }
    await optimisticCreate('dineTables',
      { code: payload.code, areaId: payload.areaId, capacity: payload.capacity, status: 'AVAILABLE' },
      () => tablesApi.createTable(payload),
      { endpoint: '/tables', body: payload }
    )
    showToast('Table created successfully', 'success')
    setIsModalOpen(false)
    setFormData({ code: '', areaId: '', capacity: '' })
  }

  const handleViewTable = async (id: string) => {
    try {
      const table = await tablesApi.getTable(id)
      setViewingTable(table)
      setIsViewModalOpen(true)
    } catch (error: any) {
      showToast(error.message || 'Failed to load table', 'error')
    }
  }

  const handleEditTable = (table: Table) => {
    setEditingTable(table)
    setEditFormData({
      code: table.code,
      areaId: table.areaId,
      capacity: table.capacity.toString(),
      status: table.status,
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateTable = async () => {
    if (!editingTable || !editFormData.code.trim() || !editFormData.areaId || !editFormData.capacity) {
      showToast('Please fill all fields', 'error')
      return
    }

    const payload = {
      code: editFormData.code.trim(),
      areaId: editFormData.areaId,
      capacity: Number(editFormData.capacity),
      status: editFormData.status,
    }
    await optimisticUpdate('dineTables', editingTable.id,
      payload,
      () => tablesApi.updateTable(editingTable.id, payload),
      { endpoint: `/tables/${editingTable.id}`, body: payload }
    )
    showToast('Table updated successfully', 'success')
    setIsEditModalOpen(false)
    setEditingTable(null)
  }

  const handleDeleteTable = async (id: string) => {
    const ok = await appConfirm({
      title: 'Delete table',
      message: 'Are you sure you want to delete this table? This will hide it from the list.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('dineTables', id,
      () => tablesApi.deleteTable(id),
      { endpoint: `/tables/${id}` }
    )
    showToast('Table deleted', 'success')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800'
      case 'OCCUPIED':
        return 'bg-red-100 text-red-800'
      case 'RESERVED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const areaNameById = useMemo(() => {
    const map = new Map<string, string>()
    ;(areas ?? []).forEach((a) => map.set(a.id, a.name))
    return map
  }, [areas])

  if (loading) return <Loading />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Tables</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-800"
        >
          + Add Table
        </button>
      </div>

      {(tables ?? []).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-700 font-medium mb-2">No tables found</p>
          <p className="text-gray-600">Create your first table to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tables ?? []).map((table) => (
            <div
              key={table.id}
              className="bg-white rounded-xl p-4 shadow hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{table.code}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {table.area?.name || areaNameById.get(table.areaId) || 'Unknown Area'}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                    table.status
                  )}`}
                >
                  {table.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Capacity:{' '}
                  <span className="font-semibold text-gray-900">{table.capacity}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewTable(table.id)}
                    className="text-blue-700 hover:text-blue-800"
                    title="View"
                  >
                    👁
                  </button>
                  <button
                    onClick={() => handleEditTable(table)}
                    className="text-red-700 hover:text-red-800"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteTable(table.id)}
                    className="text-red-700 hover:text-red-800"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setFormData({ code: '', areaId: '', capacity: '' })
        }}
        title="Add New Table"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table Code
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., T-01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
            <select
              value={formData.areaId}
              onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            >
              <option value="">Select an area</option>
              {(areas ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="e.g., 4"
              min="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleCreateTable}
            disabled={submitting}
            className="w-full bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? 'Creating...' : 'Create Table'}
          </button>
        </div>
      </Modal>

      {/* Edit Table Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingTable(null)
          setEditFormData({ code: '', areaId: '', capacity: '', status: 'AVAILABLE' })
        }}
        title="Edit Table"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table Code<span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={editFormData.code}
              onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
              placeholder="e.g., T-01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area<span className="text-red-600">*</span>
            </label>
            <select
              value={editFormData.areaId}
              onChange={(e) => setEditFormData({ ...editFormData, areaId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            >
              <option value="">Select an area</option>
              {(areas ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity<span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={editFormData.capacity}
              onChange={(e) => setEditFormData({ ...editFormData, capacity: e.target.value })}
              placeholder="e.g., 4"
              min="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={editFormData.status}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  status: e.target.value as 'AVAILABLE' | 'OCCUPIED' | 'RESERVED',
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            >
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="RESERVED">Reserved</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingTable(null)
                setEditFormData({ code: '', areaId: '', capacity: '', status: 'AVAILABLE' })
              }}
              className="flex-1 border border-red-700 text-red-700 py-2 rounded-lg font-medium hover:bg-red-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateTable}
              className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition"
            >
              Update
            </button>
          </div>
        </div>
      </Modal>

      {/* View Table Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingTable(null)
        }}
        title="Table Details"
      >
        {viewingTable && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Table Code</label>
              <p className="text-gray-900 font-semibold">{viewingTable.code}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
              <p className="text-gray-600">
                {viewingTable.area?.name || areaNameById.get(viewingTable.areaId) || 'Unknown'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <p className="text-gray-600">{viewingTable.capacity} people</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <span
                className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                  viewingTable.status
                )}`}
              >
                {viewingTable.status}
              </span>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false)
                  handleEditTable(viewingTable)
                }}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 transition"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false)
                  setViewingTable(null)
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
