/**
 * New Order state & reducer
 *
 * State management: useReducer (chosen over Zustand/Redux)
 * - Built-in, no extra deps
 * - Centralized state, explicit step transitions
 * - Easy to debug and extend
 */

'use client'

import { useReducer, useCallback } from 'react'

export type Step = 0 | 1 | 2 | 3 | 4 | 5
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
export type OrderManagementType = 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH'
export type DineInChoice = 'table' | 'counter' | null
export type DeliveryType = 'CASH_ON_DELIVERY' | 'PREPAID'

export interface MenuItem {
  id: string
  name: string
  price: number
  categoryId: string
  category?: { name: string }
  imageUrl?: string | null
}

export interface Category {
  id: string
  name: string
  imageUrl?: string | null
}

export interface Area {
  id: string
  name: string
}

export interface Table {
  id: string
  code: string
  capacity: number
  status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'
  areaId: string
  area?: { id: string; name: string }
}

export interface CartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
}

export interface NewOrderState {
  step: Step
  items: MenuItem[]
  categories: Category[]
  areas: Area[]
  tables: Table[]
  cart: CartItem[]
  orderType: OrderType
  /** Never null in final state - defaults to TABLE_BASED once loaded */
  orderManagementType: OrderManagementType | null
  dineInChoice: DineInChoice
  selectedAreaId: string
  selectedTableId: string
  counterNumber: string
  selectedCategory: string
  note: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  deliveryType: DeliveryType
  customerModalOpen: boolean
  globalSearch: string
  categorySearch: string
  billingEnabled: boolean
  loading: boolean
  submitting: boolean
}

export type NewOrderAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_DATA'; payload: { items: MenuItem[]; categories: Category[]; areas: Area[]; tables: Table[]; orderManagementType: OrderManagementType | null } }
  | { type: 'SET_ORDER_MANAGEMENT_TYPE'; payload: OrderManagementType }
  | { type: 'GO_TO_STEP'; payload: Step }
  | { type: 'SET_ORDER_TYPE'; payload: OrderType }
  | { type: 'SET_DINE_IN_CHOICE'; payload: DineInChoice }
  | { type: 'SET_SELECTED_AREA'; payload: string }
  | { type: 'SET_SELECTED_TABLE'; payload: string }
  | { type: 'SET_COUNTER_NUMBER'; payload: string }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string }
  | { type: 'SET_NOTE'; payload: string }
  | { type: 'SET_CUSTOMER'; payload: { name: string; phone: string; address: string } }
  | { type: 'SET_DELIVERY_TYPE'; payload: DeliveryType }
  | { type: 'SET_CUSTOMER_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_GLOBAL_SEARCH'; payload: string }
  | { type: 'SET_CATEGORY_SEARCH'; payload: string }
  | { type: 'SET_BILLING_ENABLED'; payload: boolean }
  | { type: 'ADD_TO_CART'; payload: MenuItem }
  | { type: 'UPDATE_QUANTITY'; payload: { menuItemId: string; quantity: number } }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'RESET_DELIVERY_STATE' }
  | { type: 'RESET_NEW_ORDER' }

const initialState: NewOrderState = {
  step: 0,
  items: [],
  categories: [],
  areas: [],
  tables: [],
  cart: [],
  orderType: 'DINE_IN',
  orderManagementType: null,
  dineInChoice: null,
  selectedAreaId: '',
  selectedTableId: '',
  counterNumber: '',
  selectedCategory: '',
  note: '',
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  deliveryType: 'CASH_ON_DELIVERY',
  customerModalOpen: false,
  globalSearch: '',
  categorySearch: '',
  billingEnabled: false,
  loading: true,
  submitting: false,
}

function normalizeOrderManagementType(
  value: OrderManagementType | null | undefined
): OrderManagementType | null {
  if (
    value === 'TABLE_BASED' ||
    value === 'COUNTER_BASED' ||
    value === 'BOTH'
  ) {
    return value
  }
  return null
}

function reducer(state: NewOrderState, action: NewOrderAction): NewOrderState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.payload }
    case 'SET_DATA': {
      const omt = normalizeOrderManagementType(action.payload.orderManagementType)
      return {
        ...state,
        items: action.payload.items,
        categories: action.payload.categories,
        areas: action.payload.areas,
        tables: action.payload.tables,
        orderManagementType: omt,
        loading: false,
      }
    }
    case 'SET_ORDER_MANAGEMENT_TYPE':
      return { ...state, orderManagementType: action.payload }
    case 'GO_TO_STEP':
      return { ...state, step: action.payload }
    case 'SET_ORDER_TYPE':
      return { ...state, orderType: action.payload }
    case 'SET_DINE_IN_CHOICE':
      return { ...state, dineInChoice: action.payload }
    case 'SET_SELECTED_AREA':
      return { ...state, selectedAreaId: action.payload }
    case 'SET_SELECTED_TABLE':
      return { ...state, selectedTableId: action.payload }
    case 'SET_COUNTER_NUMBER':
      return { ...state, counterNumber: action.payload }
    case 'SET_SELECTED_CATEGORY':
      return { ...state, selectedCategory: action.payload }
    case 'SET_NOTE':
      return { ...state, note: action.payload }
    case 'SET_CUSTOMER':
      return {
        ...state,
        customerName: action.payload.name,
        customerPhone: action.payload.phone,
        deliveryAddress: action.payload.address,
      }
    case 'SET_DELIVERY_TYPE':
      return { ...state, deliveryType: action.payload }
    case 'SET_CUSTOMER_MODAL_OPEN':
      return { ...state, customerModalOpen: action.payload }
    case 'SET_GLOBAL_SEARCH':
      return { ...state, globalSearch: action.payload }
    case 'SET_CATEGORY_SEARCH':
      return { ...state, categorySearch: action.payload }
    case 'SET_BILLING_ENABLED':
      return { ...state, billingEnabled: action.payload }
    case 'ADD_TO_CART': {
      const item = action.payload
      const existing = state.cart.find((c) => c.menuItemId === item.id)
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((c) =>
            c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
          ),
        }
      }
      return {
        ...state,
        cart: [...state.cart, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }],
      }
    }
    case 'UPDATE_QUANTITY': {
      const { menuItemId, quantity } = action.payload
      if (quantity <= 0) {
        return { ...state, cart: state.cart.filter((c) => c.menuItemId !== menuItemId) }
      }
      return {
        ...state,
        cart: state.cart.map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity } : c
        ),
      }
    }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter((c) => c.menuItemId !== action.payload) }
    case 'SET_CART':
      return { ...state, cart: action.payload }
    case 'RESET_DELIVERY_STATE':
      return {
        ...state,
        orderType: 'DELIVERY',
        step: 2,
        cart: [],
        selectedAreaId: '',
        selectedTableId: '',
        counterNumber: '',
        note: '',
        customerName: '',
        customerPhone: '',
        deliveryAddress: '',
        deliveryType: 'CASH_ON_DELIVERY',
        dineInChoice: null,
        selectedCategory: '',
        globalSearch: '',
        categorySearch: '',
      }
    case 'RESET_NEW_ORDER':
      return {
        ...initialState,
        items: state.items,
        categories: state.categories,
        areas: state.areas,
        tables: state.tables,
        orderManagementType: state.orderManagementType ?? 'TABLE_BASED',
        loading: false,
        submitting: false,
      }
    default:
      return state
  }
}

export function useNewOrderReducer() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const goToStep = useCallback((step: Step) => dispatch({ type: 'GO_TO_STEP', payload: step }), [])

  /** Safe step transition: only allow Step 4 (Order Summary) if cart is non-empty */
  const goToOrderSummary = useCallback(() => {
    if (state.cart.length > 0) {
      dispatch({ type: 'GO_TO_STEP', payload: 4 })
    }
  }, [state.cart.length])

  return { state, dispatch, goToStep, goToOrderSummary }
}
