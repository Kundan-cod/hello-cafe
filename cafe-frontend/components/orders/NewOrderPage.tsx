'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import CustomerSelectModal from '@/components/orders/CustomerSelectModal'
import Loading from '@/components/ui/Loading'
import { getItemDisplayImage } from '@/lib/utils'
import { useNewOrderReducer } from './useNewOrderReducer'
import { useNewOrder } from './useNewOrder'
import type { MenuItem, Category } from './useNewOrderReducer'

function NewOrderPageContent() {
  const router = useRouter()
  const { state, dispatch, goToStep, goToOrderSummary } = useNewOrderReducer()
  const {
    loadData,
    addToCart,
    updateQuantity,
    removeFromCart,
    handleSubmitOrder,
    resetNewOrder,
  } = useNewOrder({
    state,
    dispatch,
    goToStep,
    goToOrderSummary,
  })

  const mgmt = state.orderManagementType ?? 'TABLE_BASED'
  const totalAmount = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0)
  const selectedTable = state.tables.find((t) => t.id === state.selectedTableId)
  const selectedArea = state.areas.find((a) => a.id === state.selectedAreaId)

  // Quick menus: first 8 categories (not first 8 items)
  const quickMenuCategories = useMemo(() => state.categories.slice(0, 8), [state.categories])

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (!state.selectedCategory) return []
    return state.items.filter((item) => item.categoryId === state.selectedCategory)
  }, [state.items, state.selectedCategory])

  // Global search: top search bar – search across all items and categories
  const globalSearchResults = useMemo(() => {
    const q = state.globalSearch.trim().toLowerCase()
    if (!q) return []
    return state.items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        state.categories.find((c) => c.id === item.categoryId)?.name?.toLowerCase().includes(q)
    )
  }, [state.items, state.categories, state.globalSearch])

  // Category search: within selected category only
  const categorySearchResults = useMemo(() => {
    const q = state.categorySearch.trim().toLowerCase()
    if (!q) return filteredItems
    return filteredItems.filter((item) => item.name.toLowerCase().includes(q))
  }, [filteredItems, state.categorySearch])

  const displayedItems = state.selectedCategory ? categorySearchResults : []
  const categoryName = state.selectedCategory
    ? state.categories.find((c) => c.id === state.selectedCategory)?.name ?? ''
    : ''

  const handleCounterChange = (value: string) => {
    dispatch({ type: 'SET_COUNTER_NUMBER', payload: value })
  }

  // Step 0: Order Type Selection
  const renderStep0 = () => (
    <div className="min-h-full bg-gray-50 p-3 sm:p-4">
      <button
        onClick={() => router.push('/orders')}
        className="text-gray-600 mb-4 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">New Order</h1>
      <p className="text-gray-600 mb-6">Select order type</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => {
            dispatch({ type: 'SET_ORDER_TYPE', payload: 'DINE_IN' })
            goToStep(1)
          }}
          className="flex flex-col items-center p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-600 hover:bg-blue-50 transition-colors text-left"
        >
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">Dine-in</span>
          <span className="text-xs text-gray-500 mt-1">Select table</span>
        </button>
        <button
          onClick={() => {
            dispatch({ type: 'SET_ORDER_TYPE', payload: 'TAKEAWAY' })
            goToStep(2)
          }}
          className="flex flex-col items-center p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-600 hover:bg-blue-50 transition-colors text-left"
        >
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">Takeaway</span>
          <span className="text-xs text-gray-500 mt-1">Pick up order</span>
        </button>
        <button
          onClick={() => {
            dispatch({ type: 'SET_ORDER_TYPE', payload: 'DELIVERY' })
            goToStep(2)
          }}
          className="flex flex-col items-center p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-600 hover:bg-blue-50 transition-colors text-left"
        >
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">Delivery</span>
          <span className="text-xs text-gray-500 mt-1">Phone order</span>
        </button>
      </div>
    </div>
  )

  // Step 1: Table or Counter (DINE_IN)
  const renderStep1 = () => {
    const showTablePicker = mgmt === 'TABLE_BASED' || (mgmt === 'BOTH' && state.dineInChoice === 'table')
    const showCounterInput = mgmt === 'COUNTER_BASED' || (mgmt === 'BOTH' && state.dineInChoice === 'counter')

    if (mgmt === 'BOTH' && state.dineInChoice === null) {
      return (
        <div className="min-h-full bg-gray-50 p-3 sm:p-4">
          <button onClick={() => goToStep(0)} className="text-gray-600 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Identify customer by</h1>
          <p className="text-gray-600 mb-6">Choose table or counter number</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => dispatch({ type: 'SET_DINE_IN_CHOICE', payload: 'table' })}
              className="flex flex-col items-center p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-600 hover:bg-blue-50 transition-colors"
            >
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Table</span>
              <span className="text-xs text-gray-500 mt-1">Select from areas</span>
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_DINE_IN_CHOICE', payload: 'counter' })}
              className="flex flex-col items-center p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-600 hover:bg-blue-50 transition-colors"
            >
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Counter</span>
              <span className="text-xs text-gray-500 mt-1">Enter counter number</span>
            </button>
          </div>
        </div>
      )
    }

    if (showCounterInput) {
      const counterValid = String(state.counterNumber ?? '').trim() !== ''
      return (
        <div className="min-h-full bg-gray-50 p-3 sm:p-4">
          <button
            onClick={() => (mgmt === 'BOTH' ? dispatch({ type: 'SET_DINE_IN_CHOICE', payload: null }) : goToStep(0))}
            className="text-gray-600 mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Counter Number</h1>
          <p className="text-gray-600 mb-6">Enter the counter or seat label for this customer</p>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">Counter #</label>
            <input
              type="text"
              value={state.counterNumber}
              onChange={(e) => handleCounterChange(e.target.value)}
              placeholder="e.g. 1, A1, Window 2"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => counterValid && goToStep(2)}
            disabled={!counterValid}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      )
    }

    const groupedByArea = state.areas.map((area) => ({
      area,
      tables: state.tables.filter((t) => t.areaId === area.id),
    }))

    return (
      <div className="min-h-full bg-gray-50 p-3 sm:p-4">
        <button
          onClick={() => (mgmt === 'BOTH' ? dispatch({ type: 'SET_DINE_IN_CHOICE', payload: null }) : goToStep(0))}
          className="text-gray-600 mb-4 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Select Table</h1>

        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Notations</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { color: 'bg-gray-400', label: 'Empty' },
              { color: 'bg-red-500', label: 'Unserved' },
              { color: 'bg-yellow-500', label: 'Partially Served' },
              { color: 'bg-green-500', label: 'Served' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                <div className={`w-8 h-8 ${color} rounded flex items-center justify-center`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-900">Billing</span>
          <button
            onClick={() => dispatch({ type: 'SET_BILLING_ENABLED', payload: !state.billingEnabled })}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              state.billingEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            aria-label={state.billingEnabled ? 'Billing on' : 'Billing off'}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                state.billingEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="space-y-4">
          {groupedByArea.map(({ area, tables: areaTables }) => (
            <div key={area.id} className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">{area.name}</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {areaTables.map((table) => {
                  const getStatusColor = () => {
                    if (table.status === 'OCCUPIED') return 'bg-red-500'
                    if (table.status === 'RESERVED') return 'bg-yellow-500'
                    return 'bg-gray-400'
                  }
                  return (
                    <button
                      key={table.id}
                      onClick={() => {
                        dispatch({ type: 'SET_SELECTED_AREA', payload: area.id })
                        dispatch({ type: 'SET_SELECTED_TABLE', payload: table.id })
                        goToStep(2)
                      }}
                      className="p-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all"
                    >
                      <div className={`w-8 h-8 ${getStatusColor()} rounded mx-auto mb-2 flex items-center justify-center`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-gray-900">{table.code}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Step 2: Add items
  const renderStep2 = () => {
    const noMenuData = state.items.length === 0 && state.categories.length === 0
    const searchItems = state.globalSearch.trim() ? globalSearchResults : []

    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        {noMenuData && (
          <div className="mb-4 p-4 bg-amber-100 border-2 border-amber-400 rounded-lg">
            <p className="text-sm font-semibold text-amber-900 mb-1">
              No menu loaded.
            </p>
            <p className="text-sm text-amber-900 mb-3">
              Tap Retry to load from server.
            </p>
            <button
              type="button"
              onClick={() => loadData()}
              className="w-full min-h-[44px] px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => goToStep(state.orderType === 'TAKEAWAY' || state.orderType === 'DELIVERY' ? 0 : 1)}
            className="text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {state.orderType === 'DELIVERY' ? 'New Delivery Order' : 'New Order'}
          </h1>
          {state.orderType === 'DELIVERY' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Delivery</span>
              <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center justify-end pr-1">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          )}
          {state.orderType !== 'DELIVERY' && <div className="w-6" />}
        </div>

        {state.orderType === 'DELIVERY' && (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Type *</label>
              <select
                value={state.deliveryType}
                onChange={(e) => dispatch({ type: 'SET_DELIVERY_TYPE', payload: e.target.value as 'CASH_ON_DELIVERY' | 'PREPAID' })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="CASH_ON_DELIVERY">Cash On Delivery</option>
                <option value="PREPAID">Prepaid</option>
              </select>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_CUSTOMER_MODAL_OPEN', payload: true })}
                    className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
                    aria-label="Search customer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium text-gray-900">Customer Detail</span>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_CUSTOMER_MODAL_OPEN', payload: true })}
                  className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shrink-0"
                  aria-label="Add customer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              {state.customerName ? (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{state.customerName}</p>
                  {state.customerPhone && <p className="text-xs text-gray-600">{state.customerPhone}</p>}
                  {state.deliveryAddress && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{state.deliveryAddress}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_CUSTOMER_MODAL_OPEN', payload: true })}
                    className="text-xs text-blue-600 mt-1 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Tap + to add or select customer</p>
              )}
            </div>
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Additional Notes (optional)</label>
              <input
                type="text"
                value={state.note}
                onChange={(e) => dispatch({ type: 'SET_NOTE', payload: e.target.value })}
                placeholder="e.g. Call before delivery"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {state.orderType === 'DINE_IN' && (mgmt === 'COUNTER_BASED' || (mgmt === 'BOTH' && state.dineInChoice === 'counter')) && state.counterNumber !== '' && (
          <div className="bg-white rounded-lg p-3 mb-4 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Counter #{state.counterNumber}</p>
            <div className="mt-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={state.note}
                onChange={(e) => dispatch({ type: 'SET_NOTE', payload: e.target.value })}
                placeholder="e.g. No ice, extra spicy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
        {state.orderType === 'DINE_IN' && selectedTable && selectedArea && (
          <div className="bg-white rounded-lg p-3 mb-4 shadow-sm">
            <p className="text-sm font-medium text-gray-900">
              {selectedTable.code} - {selectedArea.name}
            </p>
            <div className="mt-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={state.note}
                onChange={(e) => dispatch({ type: 'SET_NOTE', payload: e.target.value })}
                placeholder="e.g. No ice, extra spicy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
        {state.orderType === 'TAKEAWAY' && (
          <div className="bg-white rounded-lg p-3 mb-4 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Takeaway</p>
            <div className="mt-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={state.note}
                onChange={(e) => dispatch({ type: 'SET_NOTE', payload: e.target.value })}
                placeholder="e.g. Call when ready"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Global search */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <div className="relative">
            <input
              type="text"
              value={state.globalSearch}
              onChange={(e) => dispatch({ type: 'SET_GLOBAL_SEARCH', payload: e.target.value })}
              placeholder="Search items or categories..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
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
          {state.globalSearch.trim() && (
            <div className="mt-3">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                Search results {searchItems.length > 0 && `(${searchItems.length})`}
              </h2>
              {searchItems.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No items match &quot;{state.globalSearch}&quot;</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {searchItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      categories={state.categories}
                      cart={state.cart}
                      addToCart={addToCart}
                      updateQuantity={updateQuantity}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Menus: first 8 categories */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Menus</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {quickMenuCategories.map((cat: Category) => (
              <button
                key={cat.id}
                onClick={() => {
                  dispatch({ type: 'SET_SELECTED_CATEGORY', payload: cat.id })
                  dispatch({ type: 'SET_CATEGORY_SEARCH', payload: '' })
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                  state.selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Category items */}
        {state.selectedCategory && (
          <div className="bg-white rounded-lg p-3 mb-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-gray-900">{categoryName} Menu</h2>
              <button
                onClick={() => {
                  dispatch({ type: 'SET_SELECTED_CATEGORY', payload: '' })
                  dispatch({ type: 'SET_CATEGORY_SEARCH', payload: '' })
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Change category
              </button>
            </div>
            <div className="relative mb-3">
              <input
                type="text"
                value={state.categorySearch}
                onChange={(e) => dispatch({ type: 'SET_CATEGORY_SEARCH', payload: e.target.value })}
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
                {state.categorySearch.trim() ? `No items match "${state.categorySearch}"` : 'No items in this category'}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {displayedItems.map((item) => (
                  <CategoryItemCard
                    key={item.id}
                    item={item}
                    categories={state.categories}
                    cart={state.cart}
                    addToCart={addToCart}
                    updateQuantity={updateQuantity}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!state.selectedCategory && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Categories</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {state.categories.map((category) => {
                const catImageUrl = category.imageUrl?.trim() || null
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      dispatch({ type: 'SET_SELECTED_CATEGORY', payload: category.id })
                      dispatch({ type: 'SET_CATEGORY_SEARCH', payload: '' })
                    }}
                    className={`flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 ${
                      state.selectedCategory === category.id ? 'ring-2 ring-blue-600 ring-offset-2 bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-16 h-16 bg-gray-200 rounded-full mb-2 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {catImageUrl ? (
                        <img src={catImageUrl} alt={category.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">🍽️</span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">{category.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {state.cart.length > 0 && (
          <button
            onClick={goToOrderSummary}
            className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-blue-700 active:scale-95 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-xs font-semibold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        )}
      </div>
    )
  }

  // Step 4: Order Summary
  const renderStep4 = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>
        <button
          onClick={() => goToStep(2)}
          className="text-gray-500 hover:text-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {state.orderType === 'DINE_IN' && (mgmt !== 'TABLE_BASED') && (state.dineInChoice === 'counter' || mgmt === 'COUNTER_BASED') && state.counterNumber !== '' && (
          <p className="text-sm font-medium text-gray-900 mb-4">Counter #{state.counterNumber}</p>
        )}
        {state.orderType === 'DINE_IN' && selectedTable && selectedArea && (
          <p className="text-sm font-medium text-gray-900 mb-4">
            {selectedTable.code} - {selectedArea.name}
          </p>
        )}
        {state.orderType === 'DELIVERY' && state.customerName && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{state.customerName}</p>
            {state.customerPhone && <p className="text-xs text-gray-600">{state.customerPhone}</p>}
            {state.deliveryAddress && <p className="text-xs text-gray-500 mt-1">{state.deliveryAddress}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Payment: {state.deliveryType === 'CASH_ON_DELIVERY' ? 'Cash On Delivery' : 'Prepaid'}
            </p>
          </div>
        )}
        {state.orderType === 'TAKEAWAY' && (
          <p className="text-sm font-medium text-gray-900 mb-4">Takeaway</p>
        )}

        <div className="space-y-3 mb-4">
          {state.cart.map((item) => {
            const fullItem = state.items.find((i) => i.id === item.menuItemId)
            const category = fullItem ? state.categories.find((c) => c.id === fullItem.categoryId) : undefined
            const imageUrl = fullItem ? getItemDisplayImage(fullItem, category) : null
            return (
              <div key={item.menuItemId} className="flex items-center gap-3 bg-white p-3 rounded-lg">
                {imageUrl ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                    No img
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {item.quantity} x {item.name}
                  </p>
                  <p className="text-xs text-red-600 mt-1">Rs. {(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-700 disabled:opacity-50"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                    className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-700"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.menuItemId)}
                    className="ml-2 text-red-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <span className="text-sm text-gray-700">Total Items ({totalItems})</span>
          <span className="text-lg font-bold text-gray-900">Rs. {totalAmount.toFixed(2)}</span>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea
            value={state.note}
            onChange={(e) => dispatch({ type: 'SET_NOTE', payload: e.target.value })}
            placeholder="Enter notes here"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-600 focus:ring-2 focus:ring-red-700"
          />
        </div>

        <div className="space-y-2">
          <button
            onClick={() => {
              dispatch({ type: 'SET_SELECTED_CATEGORY', payload: '' })
              goToStep(2)
            }}
            className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200"
          >
            See New Items
          </button>
          <button
            onClick={handleSubmitOrder}
            disabled={state.submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {state.submitting ? 'Confirming...' : 'Confirm Order'}
          </button>
        </div>
      </div>
    </div>
  )

  // Step 5: Success
  const renderStep5 = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 shadow-lg max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Order Added Successfully!</h2>
        <p className="text-gray-600 mb-6">Your order has been placed and is being processed.</p>
        <div className="space-y-2">
          <button
            onClick={() => router.push('/orders')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            View Orders
          </button>
          <button
            onClick={resetNewOrder}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200"
          >
            Create New Order
          </button>
        </div>
      </div>
    </div>
  )

  if (state.loading) return <Loading />

  return (
    <div className="min-h-screen bg-gray-50">
      {state.step === 0 && renderStep0()}
      {state.step === 1 && state.orderType === 'DINE_IN' && renderStep1()}
      {state.step === 2 && renderStep2()}
      {state.step === 4 && renderStep4()}
      {state.step === 5 && renderStep5()}
      <CustomerSelectModal
        isOpen={state.customerModalOpen}
        onClose={() => dispatch({ type: 'SET_CUSTOMER_MODAL_OPEN', payload: false })}
        onSelect={(c) => dispatch({ type: 'SET_CUSTOMER', payload: { name: c.name, phone: c.phone, address: c.address } })}
      />
    </div>
  )
}

// Sub-components for cleaner UI
function ItemRow({
  item,
  categories,
  cart,
  addToCart,
  updateQuantity,
}: {
  item: MenuItem
  categories: Category[]
  cart: { menuItemId: string; quantity: number }[]
  addToCart: (item: MenuItem) => void
  updateQuantity: (id: string, qty: number) => void
}) {
  const cartItem = cart.find((c) => c.menuItemId === item.id)
  const isInCart = !!cartItem
  const category = categories.find((c) => c.id === item.categoryId)
  const imageUrl = getItemDisplayImage(item, category)
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 shrink-0 flex items-center justify-center">
        {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">🍽️</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
        <p className="text-xs text-red-600 font-medium">Rs. {item.price.toFixed(2)}</p>
      </div>
      {isInCart && cartItem ? (
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
        <button onClick={() => addToCart(item)} className="shrink-0 px-2 py-1.5 rounded bg-blue-600 text-white text-xs font-medium">
          Add
        </button>
      )}
    </div>
  )
}

function CategoryItemCard({
  item,
  categories,
  cart,
  addToCart,
  updateQuantity,
}: {
  item: MenuItem
  categories: Category[]
  cart: { menuItemId: string; quantity: number }[]
  addToCart: (item: MenuItem) => void
  updateQuantity: (id: string, qty: number) => void
}) {
  const cartItem = cart.find((c) => c.menuItemId === item.id)
  const isInCart = !!cartItem
  const category = categories.find((c) => c.id === item.categoryId)
  const imageUrl = getItemDisplayImage(item, category)
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden shadow-sm">
      <div className="relative aspect-square bg-gray-100">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
            </svg>
          </div>
        )}
        {isInCart && (
          <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              onClick={() => updateQuantity(item.id, cartItem.quantity - 1)}
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
}

export default NewOrderPageContent
