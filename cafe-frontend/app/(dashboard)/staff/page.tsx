'use client'

import { useState, useEffect, useMemo } from 'react'
import { staffApi } from '@/lib/api'
import { useLocalCollection, optimisticCreate, optimisticDelete } from '@/lib/use-local'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import Loading from '@/components/ui/Loading'
import Modal from '@/components/ui/Modal'

interface Staff {
  id: string
  name: string
  email: string
  role: string
  contactNumber?: string | null
  panNumber?: string | null
  citizenshipNumber?: string | null
  salary?: number | null
  shiftStart?: string | null
  shiftEnd?: string | null
  isActive: boolean
  branchId?: string | null
  branch?: { name: string } | null
  createdAt: string
}

interface Branch {
  id: string
  name: string
}

const emptyForm = {
  name: '',
  email: '',
  contactNumber: '',
  role: 'STAFF' as 'STAFF' | 'BRANCH_OWNER',
  panNumber: '',
  citizenshipNumber: '',
  salary: '',
  shiftStart: '',
  shiftEnd: '',
  branchId: '',
  tempPassword: '',
}

export default function StaffPage() {
  const staff = useLocalCollection<Staff>('staff', staffApi.getStaff)
  const branches = useLocalCollection<Branch>('branches', () => staffApi.getBranchesForSelect())
  const loading = staff === undefined || branches === undefined
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STAFF' | 'BRANCH_OWNER'>('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState<Staff | null>(null)
  const [form, setForm] = useState(emptyForm)
  
  const [role, setRole] = useState<string | null>(null)
  const [userBranchId, setUserBranchId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRole(localStorage.getItem('role'))
      setUserBranchId(localStorage.getItem('branchId'))
    }
  }, [])

  const filtered = useMemo(() => {
    let list = staff ?? []
    if (roleFilter !== 'ALL') {
      list = list.filter((s) => s.role === roleFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.contactNumber && s.contactNumber.includes(search))
      )
    }
    return list
  }, [staff, roleFilter, search])

  const openAdd = () => {
    setForm(emptyForm)
    setViewing(null)
    setModalOpen(true)
  }

  const openView = (s: Staff) => {
    setViewing(s)
    setForm({
      name: s.name,
      email: s.email,
      contactNumber: s.contactNumber || '',
      role: (s.role as 'STAFF' | 'BRANCH_OWNER') || 'STAFF',
      panNumber: s.panNumber || '',
      citizenshipNumber: s.citizenshipNumber || '',
      salary: s.salary != null ? String(s.salary) : '',
      shiftStart: s.shiftStart || '',
      shiftEnd: s.shiftEnd || '',
      branchId: s.branchId || '',
      tempPassword: '',
    })
    setModalOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.contactNumber.trim()) {
      showToast('Name, email, and contact number are required', 'error')
      return
    }
    if (role === 'OWNER' && form.role === 'BRANCH_OWNER' && !form.branchId) {
      showToast('Branch is required for Branch Owner role', 'error')
      return
    }
    const formData = {
      name: form.name.trim(),
      email: form.email.trim(),
      contactNumber: form.contactNumber.trim(),
      role: form.role,
      panNumber: form.panNumber.trim() || undefined,
      citizenshipNumber: form.citizenshipNumber.trim() || undefined,
      salary: form.salary ? parseFloat(form.salary) : undefined,
      shiftStart: form.shiftStart.trim() || undefined,
      shiftEnd: form.shiftEnd.trim() || undefined,
      branchId:
        role === 'OWNER' && form.role === 'BRANCH_OWNER'
          ? form.branchId || undefined
          : role === 'OWNER' && form.role === 'STAFF'
            ? form.branchId || undefined
            : undefined,
      tempPassword: form.tempPassword.trim() || undefined,
    }
    await optimisticCreate('staff',
      { name: formData.name, email: formData.email, contactNumber: formData.contactNumber, role: formData.role, isActive: true },
      () => staffApi.createStaff(formData),
      { endpoint: '/staff', body: formData }
    )
    showToast('Staff added successfully', 'success')
    setModalOpen(false)
    setForm(emptyForm)
  }

  const handleRemove = async (s: Staff) => {
    const ok = await appConfirm({
      title: 'Remove staff',
      message: `Remove ${s.name} from staff? This cannot be undone.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('staff', s.id,
      () => staffApi.deleteStaff(s.id),
      { endpoint: `/staff/${s.id}` }
    )
    showToast('Staff removed', 'success')
    setModalOpen(false)
    setViewing(null)
  }

  const getRoleLabel = (r: string) => {
    if (r === 'BRANCH_OWNER') return 'Branch Owner'
    if (r === 'STAFF') return 'Staff'
    return r
  }

  if (loading) return <Loading />

  return (
    <div className="min-h-full">
      <div className="bg-white border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-4 py-3">
          <h1 className="text-base sm:text-lg font-bold text-gray-900">Cafe Staff</h1>
          {(role === 'OWNER' || role === 'BRANCH_OWNER') && (
            <button
              onClick={openAdd}
              className="self-start sm:self-center min-h-[44px] px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800"
            >
              + Staff
            </button>
          )}
        </div>
        <div className="px-3 sm:px-4 pb-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-500 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${roleFilter === 'ALL' ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              All
            </button>
            <button
              onClick={() => setRoleFilter('STAFF')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${roleFilter === 'STAFF' ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Staff
            </button>
            <button
              onClick={() => setRoleFilter('BRANCH_OWNER')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${roleFilter === 'BRANCH_OWNER' ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Branch Owner
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">No staff found</p>
            {(role === 'OWNER' || role === 'BRANCH_OWNER') && (
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800"
              >
                + Add Staff
              </button>
            )}
          </div>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-600 mt-0.5">Email: {s.email}</p>
                {s.contactNumber && (
                  <p className="text-sm text-gray-600">Contact: {s.contactNumber}</p>
                )}
                <p className="text-sm text-gray-600">
                  Role: {getRoleLabel(s.role)}
                  {s.branch?.name && ` • ${s.branch.name}`}
                </p>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span>Shift Start: {s.shiftStart || '-'}</span>
                  <span>Shift End: {s.shiftEnd || '-'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openView(s)}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-lg"
                  aria-label="View details"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                {(role === 'OWNER' || (role === 'BRANCH_OWNER' && viewing?.branchId === userBranchId)) && (
                  <button
                    onClick={() => handleRemove(s)}
                    className="w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg"
                    aria-label="Remove staff"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setViewing(null)
        }}
        title={viewing ? 'Staff Details' : 'New Staff'}
      >
        {viewing ? (
          <div className="space-y-3 text-sm">
            <p><span className="font-medium text-gray-700">Name:</span> {form.name}</p>
            <p><span className="font-medium text-gray-700">Email:</span> {form.email}</p>
            <p><span className="font-medium text-gray-700">Contact:</span> {form.contactNumber || '-'}</p>
            <p><span className="font-medium text-gray-700">Role:</span> {getRoleLabel(form.role)}</p>
            {form.panNumber && <p><span className="font-medium text-gray-700">PAN:</span> {form.panNumber}</p>}
            {form.citizenshipNumber && <p><span className="font-medium text-gray-700">Citizenship:</span> {form.citizenshipNumber}</p>}
            {form.salary && <p><span className="font-medium text-gray-700">Salary:</span> Rs. {form.salary}</p>}
            <p><span className="font-medium text-gray-700">Shift Start:</span> {form.shiftStart || '-'}</p>
            <p><span className="font-medium text-gray-700">Shift End:</span> {form.shiftEnd || '-'}</p>
                {(role === 'OWNER' || (role === 'BRANCH_OWNER' && viewing.branchId === userBranchId)) && (
                  <button
                onClick={() => handleRemove(viewing)}
                className="mt-4 w-full py-2.5 border-2 border-red-600 text-red-600 rounded-lg font-medium hover:bg-red-50"
              >
                Remove Staff
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Enter the full name"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email ID *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Enter the email ID"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
              <input
                type="tel"
                value={form.contactNumber}
                onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
                placeholder="Enter the contact number"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'STAFF' | 'BRANCH_OWNER', branchId: '' }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 bg-white focus:ring-2 focus:ring-red-700"
                required
              >
                <option value="STAFF">Staff</option>
                {role === 'OWNER' && <option value="BRANCH_OWNER">Branch Owner</option>}
              </select>
            </div>
            {form.role === 'BRANCH_OWNER' && role === 'OWNER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 bg-white focus:ring-2 focus:ring-red-700"
                  required
                >
                  <option value="">Select branch</option>
                  {(branches ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {(branches ?? []).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No branches yet. Create branches first from the Branches page.</p>
                )}
              </div>
            )}
            {form.role === 'STAFF' && role === 'OWNER' && (branches ?? []).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Branch (optional)</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 bg-white focus:ring-2 focus:ring-red-700"
                >
                  <option value="">No branch (tenant-level)</option>
                  {(branches ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
              <input
                type="text"
                value={form.panNumber}
                onChange={(e) => setForm((f) => ({ ...f, panNumber: e.target.value }))}
                placeholder="Enter the pan number"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Citizenship Number</label>
              <input
                type="text"
                value={form.citizenshipNumber}
                onChange={(e) => setForm((f) => ({ ...f, citizenshipNumber: e.target.value }))}
                placeholder="Enter the citizenship number"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password (optional)
              </label>
              <input
                type="text"
                value={form.tempPassword}
                onChange={(e) => setForm((f) => ({ ...f, tempPassword: e.target.value }))}
                placeholder="Enter a temporary password (min 6 characters) or leave empty"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
              />
              <p className="mt-1 text-xs text-gray-500">
                Default password (if left empty): <span className="font-semibold">Temp@123</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salary}
                onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                placeholder="Enter the salary"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift Start</label>
              <input
                type="time"
                value={form.shiftStart}
                onChange={(e) => setForm((f) => ({ ...f, shiftStart: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift End</label>
              <input
                type="time"
                value={form.shiftEnd}
                onChange={(e) => setForm((f) => ({ ...f, shiftEnd: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-red-700 text-white py-3 rounded-lg font-medium hover:bg-red-800"
            >
              Add Staff
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}
