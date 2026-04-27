'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { branchesApi } from '@/lib/api'
import { useLocalCollection, optimisticCreate, optimisticUpdate, optimisticDelete } from '@/lib/use-local'
import { DISTRICTS_BY_PROVINCE } from '@/lib/provinces-districts'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'

type OrderManagementType = 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH' | null

type Branch = {
  id: string
  name: string
  location: string | null
  province: string | null
  district: string | null
  contactNumber: string | null
  orderManagementType: OrderManagementType
  branchOwner: { id: string; name: string; email: string }
  createdAt: string
}

const INIT_FORM = {
  branchLocation: '',
  branchAdmin: '',
  emailId: '',
  province: '',
  district: '',
  contactNumber: '',
  tempPassword: '',
}

export default function BranchesPage() {
  const router = useRouter()
  const branches = useLocalCollection<Branch>('branches', branchesApi.getBranches)
  const loading = branches === undefined
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(INIT_FORM)
  
  const [editId, setEditId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const r = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    setRole(r)
    if (r !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [router])

  const filtered = (branches ?? []).filter(
    (b) =>
      b.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.branchOwner?.email?.toLowerCase().includes(search.toLowerCase()) ||
      b.contactNumber?.includes(search)
  )

  const openAdd = () => {
    setEditId(null)
    setForm(INIT_FORM)
    setModalOpen(true)
  }

  const openEdit = (b: Branch) => {
    setEditId(b.id)
    setForm({
      branchLocation: b.name || b.location || '',
      branchAdmin: b.branchOwner?.name || '',
      emailId: b.branchOwner?.email || '',
      province: b.province || '',
      district: b.district || '',
      contactNumber: b.contactNumber || '',
      tempPassword: '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.branchLocation?.trim() || !form.branchAdmin?.trim() || !form.emailId?.trim()) {
      showToast('Branch location, branch admin, and email are required', 'error')
      return
    }
    if (editId) {
      const payload = {
        branchLocation: form.branchLocation.trim(),
        branchAdmin: form.branchAdmin.trim(),
        emailId: form.emailId.trim(),
        province: form.province.trim() || undefined,
        district: form.district.trim() || undefined,
        contactNumber: form.contactNumber.trim() || undefined,
      }
      await optimisticUpdate('branches', editId,
        payload,
        () => branchesApi.updateBranch(editId, payload),
        { endpoint: `/branches/${editId}`, body: payload }
      )
      showToast('Branch updated successfully', 'success')
    } else {
      const payload = {
        branchLocation: form.branchLocation.trim(),
        branchAdmin: form.branchAdmin.trim(),
        emailId: form.emailId.trim(),
        province: form.province.trim() || undefined,
        district: form.district.trim() || undefined,
        contactNumber: form.contactNumber.trim() || undefined,
        tempPassword: form.tempPassword.trim() || undefined,
      }
      await optimisticCreate('branches',
        { branchLocation: payload.branchLocation, branchAdmin: payload.branchAdmin, emailId: payload.emailId, province: payload.province, district: payload.district, contactNumber: payload.contactNumber },
        () => branchesApi.createBranch(payload),
        { endpoint: '/branches', body: payload }
      )
      setSuccessMessage('Branch & branch admin Created successfully!')
      showToast('Branch & branch admin created successfully!', 'success')
    }
    setModalOpen(false)
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await appConfirm({
      title: 'Delete branch',
      message: `Delete branch "${name}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await optimisticDelete('branches', id,
      () => branchesApi.deleteBranch(id),
      { endpoint: `/branches/${id}` }
    )
    showToast('Branch deleted', 'success')
  }

  useEffect(() => {
    if (!successMessage) return
    const t = setTimeout(() => setSuccessMessage(null), 4000)
    return () => clearTimeout(t)
  }, [successMessage])

  if (role !== 'OWNER' || loading) return <Loading />

  return (
    <div>
      {/* Success notification */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
          <span className="text-green-800 font-medium flex items-center gap-2">
            <span className="text-green-600">✓</span> {successMessage}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800 text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-700"
            aria-label="Back"
            prefetch
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Branches List</h1>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="min-h-[44px] px-4 py-2.5 bg-[#1e3a5f] text-white rounded-lg font-medium hover:bg-[#2a4a7a] flex items-center justify-center gap-2"
        >
          <span className="text-lg">+</span> Branch
        </button>
      </div>

      <div className="mb-4 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 sm:p-12 text-center">
          <div className="max-w-xs mx-auto mb-4 text-gray-300">
            <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No branches found!</p>
          <p className="text-gray-500 text-sm mt-1">Added branch will be displayed here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {filtered.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 placeholder:text-gray-500  truncate">{b.name}</p>
                  <p className="text-sm text-gray-500 truncate">{b.branchOwner?.email}</p>
                  {b.contactNumber && (
                    <p className="text-sm text-gray-500">{b.contactNumber}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
                    aria-label="Edit branch"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(b.id, b.name)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                    aria-label="Delete branch"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Branch' : 'Add New Branch'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter the branch location"
              value={form.branchLocation}
              onChange={(e) => setForm((f) => ({ ...f, branchLocation: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch Admin <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter the branch admin"
              value={form.branchAdmin}
              onChange={(e) => setForm((f) => ({ ...f, branchAdmin: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email ID <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="Enter the Email id"
              value={form.emailId}
              onChange={(e) => setForm((f) => ({ ...f, emailId: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Province
            </label>
            <select
              value={form.province || ''}
              onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, district: '' }))}
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent bg-white"
            >
              <option value="">Select your province</option>
              <option value="Province 1">Province 1</option>
              <option value="Madhesh">Madhesh</option>
              <option value="Bagmati">Bagmati</option>
              <option value="Gandaki">Gandaki</option>
              <option value="Lumbini">Lumbini</option>
              <option value="Karnali">Karnali</option>
              <option value="Sudurpashchim">Sudurpashchim</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              District
            </label>
            <select
              value={form.district || ''}
              onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
              disabled={!form.province}
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {form.province ? 'Select your district' : 'Select province first'}
              </option>
              {(DISTRICTS_BY_PROVINCE[form.province] || []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Number
            </label>
            <input
              type="tel"
              placeholder="Enter the contact number"
              value={form.contactNumber}
              onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent"
            />
          </div>
          {!editId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password for Branch Admin (optional)
              </label>
              <input
                type="text"
                placeholder="Enter a temporary password (min 6 characters) or leave empty"
                value={form.tempPassword}
                onChange={(e) => setForm((f) => ({ ...f, tempPassword: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Default password (if left empty): <span className="font-semibold">Temp@123</span>
              </p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 min-h-[44px] py-2.5 border-2 border-red-600 text-red-600 rounded-lg font-medium hover:bg-red-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] py-2.5 bg-[#1e3a5f] text-white rounded-lg font-medium hover:bg-[#2a4a7a]"
            >
              {editId ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
