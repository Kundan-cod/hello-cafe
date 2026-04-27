'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { menuApi, areasApi, tablesApi, ordersApi } from '@/lib/api'
import { db } from '@/lib/db'
import { showToast } from '@/components/ui/Toast'
import Loading from '@/components/ui/Loading'
import { formatCurrency, getItemDisplayImage } from '@/lib/utils'

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

interface Area {
  id: string
  name: string
}

interface Table {
  id: string
  code: string
  area?: { id: string; name: string }
}

interface OrderItem {
  id: string
  menuItemId?: string
  quantity?: number
  price?: number
  menuItem?: {
    id?: string
    name?: string | null
    price?: number | null
  } | null
}

interface Order {
  id: string
  orderNumber: number
  totalAmount: number
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  status?: string
  paymentMode?: string
  note?: string | null
  customerName?: string | null
  customerPhone?: string | null
  deliveryAddress?: string | null
  counterNumber?: string | null
  table?: Table | null
  items?: OrderItem[]
}

const NON_EDITABLE_STATUSES: readonly string[] = ['COMPLETED', 'CANCELLED', 'CREDIT']

interface CartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
}

function buildCartFromOrder(order: Order | null): CartItem[] {
  if (!order || !Array.isArray(order.items)) return []

  return order.items
    .filter((item) => item && (item.menuItemId || item.menuItem?.id) && (item.quantity ?? 0) > 0)
    .map((item) => {
      const menuItemId = item.menuItemId ?? item.menuItem?.id!
      const quantity = item.quantity ?? 1

      const priceFromOrder = typeof item.price === 'number' && !Number.isNaN(item.price) ? item.price : undefined
      const priceFromMenuItem =
        typeof item.menuItem?.price === 'number' && !Number.isNaN(item.menuItem.price)
          ? item.menuItem.price
          : undefined

      return {
        menuItemId,
        name: item.menuItem?.name ?? 'Item',
        price: priceFromOrder ?? priceFromMenuItem ?? 0,
        quantity,
      }
    })
}

export default function EditOrderPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Track original quantities per menu item so we only send deltas when adding items
  const baselineCartRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const init = async () => {
      if (!orderId) return
      setLoading(true)
      
      // Show cached data instantly
      try {
        const [cachedOrder, cachedItems, cachedCategories, cachedAreas, cachedTables] = await Promise.all([
          db.orders.get(orderId),
          db.menuItems.toArray(),
          db.menuCategories.toArray(),
          db.areas.toArray(),
          db.dineTables.toArray(),
        ])
        if (cachedOrder) {
          setOrder(cachedOrder)
          setItems(cachedItems || [])
          setCategories(cachedCategories || [])
          setAreas(cachedAreas || [])
          setTables(cachedTables || [])
          const initialCart = buildCartFromOrder(cachedOrder)
          setCart(initialCart)
          baselineCartRef.current = initialCart.reduce<Record<string, number>>((acc, item) => {
            acc[item.menuItemId] = item.quantity
            return acc
          }, {})
          setLoading(false)
        }
      } catch {}
      
      try {
        const [orderData, itemsData, categoriesData, areasData, tablesData] = await Promise.all([
          ordersApi.getOrder(orderId),
          menuApi.getItems(),
          menuApi.getCategories(),
          areasApi.getAreas().catch(() => []),
          tablesApi.getTables().catch(() => []),
        ])
        if (!orderData) {
          throw new Error('Order not found')
        }
        setOrder(orderData)
        setItems(itemsData)
        setCategories(categoriesData)
        setAreas(areasData)
        setTables(tablesData)
        const initialCart = buildCartFromOrder(orderData)
        setCart(initialCart)
        baselineCartRef.current = initialCart.reduce<Record<string, number>>((acc, item) => {
          acc[item.menuItemId] = item.quantity
          return acc
        }, {})
      } catch (error: any) {
        showToast(error.message || 'Failed to load order details', 'error')
        router.push('/orders')
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [orderId, router])

  const quickMenuCategories = useMemo(() => categories.slice(0, 8), [categories])

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return []
    return items.filter((item) => item.categoryId === selectedCategory)
  }, [items, selectedCategory])

  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    if (!q) return []
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        categories.find((c) => c.id === item.categoryId)?.name?.toLowerCase().includes(q)
    )
  }, [items, categories, globalSearch])

  const categorySearchResults = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return filteredItems
    return filteredItems.filter((item) => item.name.toLowerCase().includes(q))
  }, [filteredItems, categorySearch])

  const displayedItems = selectedCategory ? categorySearchResults : []

  const searchItems = globalSearch.trim() ? globalSearchResults : []

  const isOrderNonEditable =
    !!order?.status && NON_EDITABLE_STATUSES.includes(order.status)

  const addToCart = (item: MenuItem) => {
    if (!order) return
    if (isOrderNonEditable) {
      showToast('Cannot edit this order in its current status', 'error')
      return
    }
    const existingItem = cart.find((c) => c.menuItemId === item.id)
    if (existingItem) {
      setCart(
        cart.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      )
    } else {
      setCart([
        ...cart,
        { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 },
      ])
    }
  }

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (isOrderNonEditable) {
      showToast('Cannot edit this order in its current status', 'error')
      return
    }
    if (quantity <= 0) {
      setCart(cart.filter((c) => c.menuItemId !== menuItemId))
    } else {
      setCart(
        cart.map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity } : c
        )
      )
    }
  }

  const removeFromCart = (menuItemId: string) => {
    if (isOrderNonEditable) {
      showToast('Cannot edit this order in its current status', 'error')
      return
    }
    setCart(cart.filter((c) => c.menuItemId !== menuItemId))
  }

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  // Calculate changes summary
  const changesSummary = useMemo(() => {
    const baseline = baselineCartRef.current || {}
    let itemsAdded = 0
    let itemsRemoved = 0
    let itemsIncreased = 0
    let itemsDecreased = 0
    let netAmountChange = 0

    // Build a map of original order item prices for accurate calculation
    const originalPrices = new Map<string, number>()
    if (order?.items) {
      order.items.forEach((orderItem) => {
        const menuItemId = orderItem.menuItemId ?? orderItem.menuItem?.id
        if (menuItemId && orderItem.price != null) {
          originalPrices.set(menuItemId, orderItem.price)
        }
      })
    }

    // Check items in cart
    cart.forEach((item) => {
      const baseQty = baseline[item.menuItemId] ?? 0
      const originalPrice = originalPrices.get(item.menuItemId) ?? item.price
      
      if (baseQty === 0) {
        // New item
        itemsAdded += item.quantity
        netAmountChange += item.price * item.quantity
      } else if (item.quantity > baseQty) {
        // Increased
        itemsIncreased += item.quantity - baseQty
        netAmountChange += item.price * (item.quantity - baseQty)
      } else if (item.quantity < baseQty) {
        // Decreased
        itemsDecreased += baseQty - item.quantity
        netAmountChange -= originalPrice * (baseQty - item.quantity)
      }
    })

    // Check removed items
    Object.keys(baseline).forEach((menuItemId) => {
      const isInCart = cart.some((c) => c.menuItemId === menuItemId)
      if (!isInCart) {
        const baseQty = baseline[menuItemId]
        itemsRemoved += baseQty
        // Use original price from order, fallback to current menu item price
        const originalPrice = originalPrices.get(menuItemId)
        const currentItem = items.find((i) => i.id === menuItemId)
        const price = originalPrice ?? currentItem?.price ?? 0
        netAmountChange -= price * baseQty
      }
    })

    const hasChanges = itemsAdded > 0 || itemsRemoved > 0 || itemsIncreased > 0 || itemsDecreased > 0

    return {
      itemsAdded,
      itemsRemoved,
      itemsIncreased,
      itemsDecreased,
      netAmountChange,
      hasChanges,
    }
  }, [cart, items, order])

  const handleSubmit = async () => {
    if (!order) return

    if (isOrderNonEditable) {
      showToast('Cannot edit this order in its current status', 'error')
      return
    }

    const baseline = baselineCartRef.current || {}
    const itemsToUpdate: Array<{ menuItemId: string; quantity: number }> = []

    // Process items currently in cart (includes new items, increases, and decreases)
    cart.forEach((item) => {
      const baseQty = baseline[item.menuItemId] ?? 0
      // Only send if quantity changed
      if (item.quantity !== baseQty) {
        itemsToUpdate.push({ menuItemId: item.menuItemId, quantity: item.quantity })
      }
    })

    // Process items that were removed (in baseline but not in cart)
    Object.keys(baseline).forEach((menuItemId) => {
      const isInCart = cart.some((c) => c.menuItemId === menuItemId)
      if (!isInCart) {
        // Item was removed, send quantity 0 to remove it
        itemsToUpdate.push({ menuItemId, quantity: 0 })
      }
    })

    // Check if there are any changes
    if (itemsToUpdate.length === 0) {
      showToast('No changes to save', 'info')
      return
    }

    try {
      setSubmitting(true)
      await ordersApi.addItems(orderId, {
        items: itemsToUpdate,
      })

      // Cache the updated order
      try {
        const freshOrder = await ordersApi.getOrder(orderId)
        if (freshOrder) await db.orders.put(freshOrder)
      } catch {}

      showToast('Order updated successfully', 'success')
      router.push(`/orders`)
    } catch (error: any) {
      showToast(error.message || 'Failed to update order', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!order) {
    return <Loading />
  }

  const table = order.table
  const areaId = table?.area?.id
  const area = areaId ? areas.find((a) => a.id === areaId) : undefined

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Edit Order #{order.orderNumber}</h1>
        <div className="w-6" />
      </div>

      <div className="p-4 space-y-4">
        {/* Order info */}
        {order.orderType === 'DELIVERY' && (order.customerName || order.deliveryAddress) ? (
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Delivery</p>
            {order.paymentMode && (
              <p className="text-xs text-gray-500">
                Payment: {order.paymentMode === 'CASH' ? 'Cash On Delivery' : order.paymentMode === 'CARD' ? 'Prepaid' : order.paymentMode}
              </p>
            )}
            {order.customerName && <p className="text-sm text-gray-700">{order.customerName}</p>}
            {order.customerPhone && <p className="text-xs text-gray-600">{order.customerPhone}</p>}
            {order.deliveryAddress && <p className="text-xs text-gray-600 mt-1">{order.deliveryAddress}</p>}
            {order.note && (
              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-gray-100">
                Note: {order.note}
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Current total: {formatCurrency(order.totalAmount)}
            </p>
          </div>
        ) : order.counterNumber != null ? (
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Counter #{order.counterNumber}</p>
            {order.note && (
              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-gray-100">
                Note: {order.note}
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Current total: {formatCurrency(order.totalAmount)}
            </p>
          </div>
        ) : table ? (
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-900">
              {table.code} {area ? `- ${area.name}` : ''}
            </p>
            {order.note && (
              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-gray-100">
                Note: {order.note}
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Current total: {formatCurrency(order.totalAmount)}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Takeaway</p>
            {order.note && (
              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-gray-100">
                Note: {order.note}
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Current total: {formatCurrency(order.totalAmount)}
            </p>
          </div>
        )}

        {/* Search items - global search across all items and categories */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="relative">
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search items or categories..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
          {globalSearch.trim() && (
            <div className="mt-3">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                Search results {searchItems.length > 0 && `(${searchItems.length})`}
              </h2>
              {searchItems.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No items match &quot;{globalSearch}&quot;</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {searchItems.map((item) => {
                    const cartItem = cart.find((c) => c.menuItemId === item.id)
                    const isInCart = !!cartItem
                    const category = categories.find((c) => c.id === item.categoryId)
                    const imageUrl = getItemDisplayImage(item, category)
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 shrink-0 flex items-center justify-center">
                          {imageUrl ? (
                            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg">🍽️</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-red-600 font-medium">Rs. {item.price.toFixed(2)}</p>
                        </div>
                        {isInCart ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => updateQuantity(item.id, cartItem.quantity - 1)}
                              className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center text-sm font-bold"
                            >
                              −
                            </button>
                            <span className="text-sm text-gray-600 font-semibold w-6 text-center">{cartItem.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, cartItem.quantity + 1)}
                              className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center text-sm font-bold"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="shrink-0 px-2 py-1.5 rounded bg-blue-600 text-white text-xs font-medium"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick menus */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Menus</h2>
          {quickMenuCategories.length === 0 ? (
            <p className="text-xs text-gray-500">No items available.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickMenuCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id)
                    setCategorySearch('')
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category items - compact design when category selected */}
        {selectedCategory ? (
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-gray-900">
                {categories.find((c) => c.id === selectedCategory)?.name || ''} Menu
              </h2>
              <button
                onClick={() => {
                  setSelectedCategory('')
                  setCategorySearch('')
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Change category
              </button>
            </div>
            <div className="relative mb-3">
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search in this category..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {displayedItems.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">
                {categorySearch.trim() ? `No items match "${categorySearch}"` : 'No items in this category'}
              </p>
            ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {displayedItems.map((item) => {
                const cartItem = cart.find((c) => c.menuItemId === item.id)
                const isInCart = !!cartItem
                const category = categories.find((c) => c.id === item.categoryId)
                const imageUrl = getItemDisplayImage(item, category)

                return (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden shadow-sm"
                  >
                    <div className="relative aspect-square bg-gray-100">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <svg
                            className="w-8 h-8 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
                          </svg>
                        </div>
                      )}
                      {isInCart && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <h3 className="text-xs font-medium text-gray-900 truncate leading-tight">{item.name}</h3>
                      <p className="text-xs font-semibold text-red-600 mb-1.5">Rs. {item.price.toFixed(2)}</p>
                      {isInCart && cartItem ? (
                        <div className="flex items-center justify-between bg-blue-600 rounded px-1 py-1 min-h-[32px]">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, Math.max(1, cartItem.quantity - 1))
                            }
                            className="text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded hover:bg-blue-700"
                          >
                            −
                          </button>
                          <span className="text-white text-xs font-semibold">{cartItem.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, cartItem.quantity + 1)}
                            className="text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded hover:bg-blue-700"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="w-full bg-blue-600 text-white text-xs font-medium py-1.5 rounded hover:bg-blue-700 min-h-[32px]"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            )}
          </div>
        ) : (
          /* Categories with logos - show when no category selected */
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Categories</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {categories.map((category) => {
                const catImageUrl = category.imageUrl?.trim() || null
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id)
                      setCategorySearch('')
                      setGlobalSearch('')
                    }}
                    className={`flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 ${
                      selectedCategory === category.id ? 'ring-2 ring-blue-600 ring-offset-2 bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-16 h-16 bg-gray-200 rounded-full mb-2 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {catImageUrl ? (
                        <img src={catImageUrl} alt={category.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">🍽️</span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center">{category.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Cart summary */}
        <div className="bg-white border rounded-lg p-4 shadow-sm w-full box-border overflow-hidden">
          <div className="flex items-center justify-between mb-3 gap-2 min-w-0 w-full">
            <div className="min-w-0 flex-1 overflow-hidden">
              {changesSummary.hasChanges ? (
                <>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Changes
                  </p>
                  <p className={`text-xs ${changesSummary.netAmountChange >= 0 ? 'text-gray-600' : 'text-red-600'} truncate`}>
                    {changesSummary.netAmountChange >= 0 ? '+' : ''}{formatCurrency(changesSummary.netAmountChange)}
                    {changesSummary.netAmountChange !== 0 && (
                      <span className="text-gray-500 ml-1">
                        ({changesSummary.itemsAdded + changesSummary.itemsIncreased > 0 && `+${changesSummary.itemsAdded + changesSummary.itemsIncreased}`}
                        {changesSummary.itemsRemoved + changesSummary.itemsDecreased > 0 && ` -${changesSummary.itemsRemoved + changesSummary.itemsDecreased}`})
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Current items ({totalItems})
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    Total: {formatCurrency(totalAmount)}
                  </p>
                </>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !changesSummary.hasChanges || isOrderNonEditable}
              className="bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50 flex-shrink-0 whitespace-nowrap"
            >
              {submitting ? 'Updating...' : 'Update Order'}
            </button>
          </div>

          {cart.length > 0 && (
            <div className="overflow-x-hidden space-y-2 text-sm text-gray-800 w-full max-w-full">
              {cart.map((item) => {
                const fullItem = items.find((i) => i.id === item.menuItemId)
                const category = fullItem
                  ? categories.find((c) => c.id === fullItem.categoryId)
                  : undefined
                const imageUrl = fullItem
                  ? getItemDisplayImage(fullItem, category)
                  : null
                return (
                  <div key={item.menuItemId} className="flex gap-2 min-w-0 w-full">
                    {imageUrl ? (
                      <div className="w-8 h-8 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">—</div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="min-w-0">
                        <span className="block min-w-0 truncate text-left">
                          {item.quantity} x {item.name}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2 min-w-0">
                        <span className="text-xs text-gray-700 whitespace-nowrap">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.menuItemId)}
                          className="text-xs text-red-600 flex-shrink-0 whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

