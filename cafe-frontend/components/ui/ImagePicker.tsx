'use client'

import { useState, useMemo, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { FOOD_ICON_PRESETS, getColoredSvgDataUrl } from '@/lib/food-icons'

// Preset images from local food icons (colored at runtime)
export const PRESET_IMAGES = FOOD_ICON_PRESETS.map((p) => ({
  id: p.id,
  label: p.label,
  path: p.path,
  color: p.color,
}))

const GALLERY_INITIAL_COUNT = 9

interface ImagePickerProps {
  value: string | null
  onChange: (url: string | null) => void
  label?: string
  required?: boolean
  compact?: boolean
}

export default function ImagePicker({
  value,
  onChange,
  label = 'Image',
  required = false,
  compact = false,
}: ImagePickerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [galleryCount, setGalleryCount] = useState(GALLERY_INITIAL_COUNT)
  const [searchQuery, setSearchQuery] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      onChange(reader.result as string)
      setIsModalOpen(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return PRESET_IMAGES
    const q = searchQuery.toLowerCase()
    return PRESET_IMAGES.filter(
      (p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const visiblePresets = filteredPresets.slice(0, galleryCount)
  const hasMore = galleryCount < filteredPresets.length

  const [loadedUrls, setLoadedUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!isModalOpen) return
    Promise.all(
      PRESET_IMAGES.map((p) =>
        getColoredSvgDataUrl(p.path, p.color).then((url) => ({ id: p.id, url }))
      )
    ).then((results) => {
      setLoadedUrls((prev) => ({
        ...prev,
        ...Object.fromEntries(results.map((r) => [r.id, r.url])),
      }))
    })
  }, [isModalOpen])

  const handleSelectPreset = (url: string) => {
    onChange(url)
    setIsModalOpen(false)
  }

  const handleSeeMore = () => {
    setGalleryCount((c) => Math.min(c + 9, filteredPresets.length))
  }

  const openModal = () => {
    setGalleryCount(GALLERY_INITIAL_COUNT)
    setSearchQuery('')
    setImgError(false)
    setIsModalOpen(true)
  }

  useEffect(() => {
    setImgError(false)
  }, [value])

  const hasValue = !!value
  const [imgError, setImgError] = useState(false)
  const showPreview = hasValue && !imgError

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-600">*</span>}
        </label>
      )}

      {/* Simple "Choose or upload" box – no images shown in advance */}
      {hasValue ? (
        <div className="border-2 border-gray-200 rounded-lg p-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-600 mb-2">Selected image</p>
          <div className="flex items-center gap-3">
            <img
              src={value}
              alt="Selected"
              className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0 bg-white"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">Image selected. Click below to change.</p>
              <button
                type="button"
                onClick={openModal}
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-800"
              >
                Change image
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className={`w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition text-gray-600 ${
            compact ? 'py-4' : 'py-8'
          }`}
        >
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-600">Choose or upload</span>
        </button>
      )}

      {/* Modal: shown only when user clicks "Choose or upload" */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload Image"
      >
        <div className="space-y-4">
          {/* Upload from device – simple + icon and "Upload Image" */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload Image{required ? '*' : ''}
            </label>
            <label className="flex flex-col items-center justify-center w-full py-10 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 rounded-full bg-red-700 flex items-center justify-center mb-2">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Upload Image</span>
            </label>
          </div>

          {/* Or separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-sm font-medium text-amber-600">Or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Choose from Gallery – only visible in modal */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Choose from Gallery</p>
            <div className="relative mb-3">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Image"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {visiblePresets.map((preset) => {
                const url = loadedUrls[preset.id]
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => url && handleSelectPreset(url)}
                    disabled={!url}
                    className="aspect-square rounded-lg border-2 border-gray-200 overflow-hidden hover:border-red-600 transition disabled:opacity-60 flex items-center justify-center bg-gray-50 p-4"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={preset.label}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-8 h-8 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin" />
                    )}
                  </button>
                )
              })}
            </div>
            {hasMore && (
              <button
                type="button"
                onClick={handleSeeMore}
                className="w-full mt-3 py-2.5 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800"
              >
                See More
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
