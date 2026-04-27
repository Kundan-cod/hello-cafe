'use client'

interface Props {
  category: {
    id: string
    name: string
    total: number
    imageUrl: string | null
  }
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function CategoryCard({
  category,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const hasImage = category.imageUrl && category.imageUrl.trim() !== ''

  return (
    <div className="bg-white rounded-xl p-4 flex items-center justify-between shadow">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {hasImage ? (
            <img
              src={category.imageUrl!}
              alt={category.name}
              className="w-full h-full object-cover"
              width={48}
              height={48}
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{category.name}</p>
          <p className="text-sm text-gray-600 mt-1">Active items: {category.total}</p>
        </div>
      </div>

      <div className="flex gap-3 text-red-700">
        {onView && (
          <button
            onClick={onView}
            className="text-blue-700 hover:text-blue-800"
            title="View"
          >
            👁
          </button>
        )}
        {onEdit && (
          <button onClick={onEdit} className="hover:text-red-800" title="Edit">
            ✏️
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="hover:text-red-800" title="Delete">
            🗑
          </button>
        )}
      </div>
    </div>
  )
}