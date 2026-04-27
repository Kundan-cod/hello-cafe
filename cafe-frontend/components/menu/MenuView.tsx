'use client'

import { menuApi } from '@/lib/api'
import Loading from '@/components/ui/Loading'
import { formatCurrency, getItemDisplayImage } from '@/lib/utils'
import { useLocalCollection } from '@/lib/use-local'

interface MenuItem {
  id: string
  name: string
  price: number
  categoryId: string
  imageUrl?: string | null
}

interface Category {
  id: string
  name: string
  imageUrl?: string | null
}

export default function MenuView({ refreshKey = 0 }: { refreshKey?: number }) {
  const items = useLocalCollection<MenuItem>('menuItems', menuApi.getItems)
  const categories = useLocalCollection<Category>('menuCategories', menuApi.getCategories)
  const loading = items === undefined || categories === undefined

  const categoryMap = new Map<string, Category>()
  ;(categories ?? []).forEach((c) => categoryMap.set(c.id, c))

  const itemsByCategory = new Map<string, MenuItem[]>()
  ;(items ?? []).forEach((item) => {
    const list = itemsByCategory.get(item.categoryId) ?? []
    itemsByCategory.set(item.categoryId, [...list, item])
  })

  // Order: categories that have items, sorted by category name; then "Other" for unknown categoryIds
  const categoryIdsWithItems = Array.from(itemsByCategory.keys())
  const sortedCategories = categoryIdsWithItems
    .map((id) => categoryMap.get(id))
    .filter(Boolean) as Category[]
  sortedCategories.sort((a, b) => a.name.localeCompare(b.name))

  const unknownCategoryIds = categoryIdsWithItems.filter(
    (id) => !categoryMap.has(id)
  )

  if (loading) return <Loading />

  return (
    <div className="divide-y divide-gray-200">
      {sortedCategories.map((category) => {
        const categoryItems = itemsByCategory.get(category.id) ?? []
        if (categoryItems.length === 0) return null
        return (
          <section key={category.id} className="py-4 first:pt-0">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              {category.name}
            </h2>
            <ul className="space-y-2">
              {categoryItems.map((item) => {
                const imageUrl = getItemDisplayImage(item, category)
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-2"
                  >
                    {imageUrl ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
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
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                        No img
                      </div>
                    )}
                    <span className="flex-1 text-gray-900 font-medium">
                      {item.name}
                    </span>
                    <span className="text-gray-700 tabular-nums">
                      {formatCurrency(item.price)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {unknownCategoryIds.length > 0 && (
        <section className="py-4">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Other
          </h2>
          <ul className="space-y-2">
            {unknownCategoryIds.flatMap((id) =>
              (itemsByCategory.get(id) ?? []).map((item) => {
                const category = categoryMap.get(id)
                const imageUrl = getItemDisplayImage(
                  item,
                  category ?? undefined
                )
                return (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    {imageUrl ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
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
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                        No img
                      </div>
                    )}
                    <span className="flex-1 text-gray-900 font-medium">
                      {item.name}
                    </span>
                    <span className="text-gray-700 tabular-nums">
                      {formatCurrency(item.price)}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        </section>
      )}
      {(items ?? []).length === 0 && (
        <div className="py-12 text-center text-gray-500 text-sm">
          No items in menu yet.
        </div>
      )}
    </div>
  )
}
