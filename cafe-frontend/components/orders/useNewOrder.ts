/**
 * New Order business logic: loadData, handleSubmitOrder, cart helpers.
 * Uses useNewOrderReducer for state.
 */

"use client"

import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ordersApi, tenantApi, areasApi, tablesApi, menuApi } from '@/lib/api'
import { showToast } from '@/components/ui/Toast'
import { db } from '@/lib/db'
import type {
  NewOrderState,
  NewOrderAction,
  MenuItem,
  CartItem,
  Step,
} from './useNewOrderReducer'

const CART_STORAGE_KEY = 'cafe-new-order-cart'

/** Restore cart from localStorage (optional, session-scoped) */
function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Persist cart to localStorage */
function saveCartToStorage(cart: CartItem[]): void {
  if (typeof window === 'undefined') return
  try {
    if (cart.length === 0) {
      localStorage.removeItem(CART_STORAGE_KEY)
    } else {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    }
  } catch {
    /* ignore */
  }
}

export interface UseNewOrderOptions {
  state: NewOrderState
  dispatch: React.Dispatch<NewOrderAction>
  goToStep: (step: Step) => void
  goToOrderSummary: () => void
}

export function useNewOrder(options: UseNewOrderOptions) {
  const { state, dispatch, goToStep, goToOrderSummary } = options
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')
  const loadData = useCallback(async () => {
    const branchId = typeof window !== 'undefined' ? localStorage.getItem('branchId') : null
    try {
      dispatch({ type: 'SET_LOADING', payload: true })

      // Show cached data instantly from IndexedDB while server fetches in background
      try {
        const [cachedItems, cachedCategories, cachedAreas, cachedTables, cachedTenant] = await Promise.all([
          db.menuItems.toArray(),
          db.menuCategories.toArray(),
          db.areas.toArray(),
          db.dineTables.toArray(),
          db.tenant.toCollection().first(),
        ])
        if (cachedItems.length > 0 || cachedCategories.length > 0) {
          let omt: 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH' | null = null
          if (cachedTenant?.orderManagementType === 'TABLE_BASED' || cachedTenant?.orderManagementType === 'COUNTER_BASED' || cachedTenant?.orderManagementType === 'BOTH') {
            omt = cachedTenant.orderManagementType
          }
          dispatch({
            type: 'SET_DATA',
            payload: { items: cachedItems, categories: cachedCategories, areas: cachedAreas, tables: cachedTables, orderManagementType: omt },
          })
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      } catch {}

      const [itemsData, categoriesData, areasData, tablesData, tenantData] = await Promise.all([
        menuApi.getItems(),
        menuApi.getCategories(),
        areasApi.getAreas().catch(() => []),
        tablesApi.getTables().catch(() => []),
        tenantApi.getMe(branchId).catch(() => ({ orderManagementType: null })),
      ])
      let orderManagementType: 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH' | null = null
      if (
        tenantData?.orderManagementType === 'TABLE_BASED' ||
        tenantData?.orderManagementType === 'COUNTER_BASED' ||
        tenantData?.orderManagementType === 'BOTH'
      ) {
        orderManagementType = tenantData.orderManagementType
      }
      dispatch({
        type: 'SET_DATA',
        payload: {
          items: itemsData,
          categories: categoriesData,
          areas: areasData,
          tables: tablesData,
          orderManagementType,
        },
      })
      const restored = loadCartFromStorage()
      if (restored.length > 0 && itemsData.length > 0) {
        const validIds = new Set(itemsData.map((i: MenuItem) => i.id))
        const validCart = restored.filter(
          (c) => validIds.has(c.menuItemId) && c.quantity > 0
        )
        if (validCart.length > 0) {
          dispatch({ type: 'SET_CART', payload: validCart })
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load data'
      showToast(msg, 'error')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [dispatch])

  /** ?type=delivery: set DELIVERY, reset stale state */
  useEffect(() => {
    if (typeParam === 'delivery') {
      dispatch({ type: 'RESET_DELIVERY_STATE' })
    }
  }, [typeParam, dispatch])

  /** Initial load */
  useEffect(() => {
    loadData()
  }, [loadData])

  // Cart helpers
  const addToCart = useCallback(
    (item: MenuItem) => {
      dispatch({ type: 'ADD_TO_CART', payload: item })
    },
    [dispatch]
  )

  const updateQuantity = useCallback(
    (menuItemId: string, quantity: number) => {
      if (quantity < 0) return
      dispatch({ type: 'UPDATE_QUANTITY', payload: { menuItemId, quantity } })
    },
    [dispatch]
  )

  const removeFromCart = useCallback(
    (menuItemId: string) => {
      dispatch({ type: 'REMOVE_FROM_CART', payload: menuItemId })
    },
    [dispatch]
  )

  /** Persist cart when it changes */
  useEffect(() => {
    saveCartToStorage(state.cart)
  }, [state.cart])

  const buildOrderPayload = useCallback((): {
    paymentMode: 'CASH' | 'QR' | 'CARD'
    orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
    tableId?: string
    counterNumber?: string
    note?: string
    customerName?: string
    customerPhone?: string
    deliveryAddress?: string
    items: Array<{ menuItemId: string; quantity: number }>
  } => {
    const mgmt = state.orderManagementType ?? 'TABLE_BASED'
    const useTable =
      state.orderType === 'DINE_IN' &&
      (mgmt === 'TABLE_BASED' || (mgmt === 'BOTH' && state.dineInChoice === 'table'))
    const useCounter =
      state.orderType === 'DINE_IN' &&
      (mgmt === 'COUNTER_BASED' || (mgmt === 'BOTH' && state.dineInChoice === 'counter'))

    const paymentMode: 'CASH' | 'QR' | 'CARD' =
      state.orderType === 'DELIVERY' && state.deliveryType === 'PREPAID' ? 'CARD' : 'CASH'
    const counterTrimmed = typeof state.counterNumber === 'string' ? state.counterNumber.trim() : ''

    const payload = {
      orderType: state.orderType,
      tableId: useTable ? state.selectedTableId || undefined : undefined,
      counterNumber: useCounter && counterTrimmed !== '' ? counterTrimmed : undefined,
      note: state.note.trim() || undefined,
      customerName: state.orderType === 'DELIVERY' ? state.customerName.trim() || undefined : undefined,
      customerPhone: state.orderType === 'DELIVERY' ? state.customerPhone.trim() || undefined : undefined,
      deliveryAddress:
        state.orderType === 'DELIVERY' ? state.deliveryAddress.trim() || undefined : undefined,
      paymentMode,
      items: state.cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      })),
    }
    return payload
  }, [state])

  const handleSubmitOrder = useCallback(async () => {
    if (state.cart.length === 0) {
      showToast('Please add items to cart', 'error')
      return
    }

    const mgmt = state.orderManagementType ?? 'TABLE_BASED'

    if (state.orderType === 'DINE_IN') {
      if (mgmt === 'TABLE_BASED') {
        if (!state.selectedAreaId || !state.selectedTableId) {
          showToast('Please select area and table', 'error')
          return
        }
      } else if (mgmt === 'COUNTER_BASED') {
        if (!String(state.counterNumber ?? '').trim()) {
          showToast('Please enter counter number', 'error')
          return
        }
      } else if (mgmt === 'BOTH') {
        if (state.dineInChoice === 'table') {
          if (!state.selectedAreaId || !state.selectedTableId) {
            showToast('Please select area and table', 'error')
            return
          }
        } else if (state.dineInChoice === 'counter') {
          if (!String(state.counterNumber ?? '').trim()) {
            showToast('Please enter counter number', 'error')
            return
          }
        } else {
          showToast('Please select table or counter', 'error')
          return
        }
      }
    }

    if (state.orderType === 'DELIVERY') {
      if (!state.customerName.trim()) {
        showToast('Customer name is required', 'error')
        return
      }
      if (!state.customerPhone.trim()) {
        showToast('Customer phone is required', 'error')
        return
      }
      if (!state.deliveryAddress.trim()) {
        showToast('Delivery address is required', 'error')
        return
      }
    }

    const payload = buildOrderPayload()

    try {
      dispatch({ type: 'SET_SUBMITTING', payload: true })
      goToStep(5)
      showToast('Confirming order…', 'info')
      const createdOrder = await ordersApi.createOrder(payload)
      // Cache the new order so it appears instantly in the orders list
      try {
        if (createdOrder?.id) await db.orders.put(createdOrder)
      } catch {}
      showToast('Order confirmed', 'success')
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string }
      showToast(err?.message || 'Failed to create order', 'error')
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [state, buildOrderPayload, dispatch, goToStep]);

  const resetNewOrder = useCallback(() => {
    dispatch({ type: 'RESET_NEW_ORDER' })
  }, [dispatch])

  return {
    loadData,
    addToCart,
    updateQuantity,
    removeFromCart,
    handleSubmitOrder,
    resetNewOrder,
    goToStep,
    goToOrderSummary,
  }
}
