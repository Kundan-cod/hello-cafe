'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import MenuView from '@/components/menu/MenuView'
import { showToast } from '@/components/ui/Toast'

export default function MenusPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCsvUpload = async (file: File | null) => {
    if (!file) return
    try {
      setUploading(true)

      const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL ??
        (typeof window !== 'undefined'
          ? `${window.location.protocol}//${window.location.hostname}:3001`
          : 'http://localhost:3001')

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${baseUrl}/menu/bulk-csv`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }))
        throw new Error(err.message || 'Upload failed')
      }

      showToast('Menu imported successfully from CSV', 'success')
      setRefreshKey((prev) => prev + 1)
    } catch (err: any) {
      showToast(err.message || 'Failed to upload CSV', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/menu')}
            className="rounded-full p-1.5 hover:bg-gray-100 text-gray-700"
          >
            <span className="sr-only">Back</span>
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 19L8 12L15 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Menu</h1>
            <p className="text-xs text-gray-600 mt-0.5">
              Upload a CSV to quickly create or replace categories and items.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-red-800"
          >
            <span>Export</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <a
              href="data:text/csv;charset=utf-8,category_name%2Citem_name%2Cprice%2Cimage_url%2Cis_available%0ACoffee%2CAmericano%2C150%2C%2Ctrue%0ACoffee%2CLatte%2C200%2C%2Ctrue"
              download="menu-template.csv"
              className="text-xs sm:text-sm text-red-700 hover:text-red-800 underline"
            >
              Download CSV template
            </a>
            <label className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-red-800 cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  void handleCsvUpload(file)
                  e.target.value = ''
                }}
                disabled={uploading}
              />
              {uploading ? 'Uploading…' : 'Import CSV'}
            </label>
          </div>
        </div>
      </div>

      <MenuView refreshKey={refreshKey} />
    </div>
  )
}
