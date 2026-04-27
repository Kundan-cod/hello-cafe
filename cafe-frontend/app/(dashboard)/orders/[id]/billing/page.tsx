'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { discountsApi, customersApi, ordersApi } from '@/lib/api'
import { db } from '@/lib/db'
import { showToast } from '@/components/ui/Toast'
import { appConfirm } from '@/components/ui/AppDialog'
import Loading from '@/components/ui/Loading'
import { getItemDisplayImage } from '@/lib/utils'

interface CreditorOption {
  id: string
  name: string
  creditBalance: number
}

interface Order {
  id: string
  orderNumber: number
  totalAmount: number
  paymentMode: string
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  status?: string
  note?: string | null
  customerName?: string | null
  customerPhone?: string | null
  deliveryAddress?: string | null
  counterNumber?: string | null
  table?: {
    id: string
    code: string
    area?: { id: string; name: string } | null
  } | null
  createdAt: string
  items: Array<{
    id: string
    menuItemId: string
    quantity: number
    price: number
    status?: string
    menuItem: {
      id: string
      name: string
      categoryId: string | null
      imageUrl?: string | null
      category?: { id: string; imageUrl?: string | null } | null
    }
  }>
}

type PaymentType = 'FULL' | 'BILL_SPLITTING' | 'PARTIAL'

export default function OrderBillingPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = ((params.id as string | undefined) ?? '').trim()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [discount, setDiscount] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('FULL')
  const [cashAmount, setCashAmount] = useState('')
  const [esewaAmount, setEsewaAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [isVatBill, setIsVatBill] = useState(false)
  const [vatName, setVatName] = useState('')
  const [vatPan, setVatPan] = useState('')
  const [vatAddress, setVatAddress] = useState('')
  const [vatPhone, setVatPhone] = useState('')
  const [offers, setOffers] = useState<Array<{
    id: string
    name: string
    code?: string | null
    type: string
    value: number
    scope?: string
    categoryIds?: string[] | null
    menuItemIds?: string[] | null
    minOrderAmount?: number | null
  }>>([])
  const [offerCode, setOfferCode] = useState('')
  const [appliedOffer, setAppliedOffer] = useState<{ name: string; code?: string; eligibleSubTotal?: number } | null>(null)
  const canBill = order
    ? ['PENDING', 'PREPARING', 'READY'].includes(order.status ?? '')
    : false

  // Partial payment: paid amount, creditor (existing or new)
  const [paidAmount, setPaidAmount] = useState('')
  const [creditors, setCreditors] = useState<CreditorOption[]>([])
  const [creditorsLoading, setCreditorsLoading] = useState(false)
  const [creditorChoice, setCreditorChoice] = useState<'existing' | 'new'>('existing')
  const [selectedCreditorId, setSelectedCreditorId] = useState('')
  const [newCreditorName, setNewCreditorName] = useState('')
  const [newCreditorPhone, setNewCreditorPhone] = useState('')

  useEffect(() => {
    if (!orderId) return
    loadOrder()
  }, [orderId])

  useEffect(() => {
    if (paymentType === 'PARTIAL' && canBill) {
      setCreditorsLoading(true)
      customersApi
        .getCustomers('CREDITOR')
        .then((list: CreditorOption[]) => setCreditors(list))
        .catch(() => setCreditors([]))
        .finally(() => setCreditorsLoading(false))
    }
  }, [paymentType, canBill])

  const loadOrder = async () => {
    try {
      setLoading(true)
      
      // Show cached order instantly
      try {
        const cached = await db.orders.get(orderId)
        if (cached) {
          const orderWithStatus = {
            ...cached,
            items: (cached.items || []).map((item: any) => ({
              ...item,
              status: item.status || 'PENDING',
            })),
          }
          setOrder(orderWithStatus)
          setCreditAmount(cached.totalAmount?.toFixed(2) || '0')
          setLoading(false)
        }
      } catch {}
      
      const [orderData, offersData] = await Promise.all([
        ordersApi.getOrder(orderId),
        discountsApi.getActiveForOrder().catch(() => []),
      ])
      const orderWithStatus = {
        ...orderData,
        items: orderData.items.map((item: any) => ({
          ...item,
          status: item.status || 'PENDING',
        })),
      }
      setOrder(orderWithStatus)
      setCreditAmount(orderData.totalAmount.toFixed(2))
      setOffers(Array.isArray(offersData) ? offersData : [])
      
      // Cache the fresh order
      try { await db.orders.put(orderData) } catch {}
    } catch (error: any) {
      showToast(error.message || 'Failed to load order', 'error')
      router.push('/orders')
    } finally {
      setLoading(false)
    }
  }

  const roundCredit = (n: number) => Math.round(n)
  const buildCreditNote = (paid: number) => {
    if (!order) return ''
    const itemsStr = order.items
      .map((i) => `${i.menuItem.name} x${i.quantity}`)
      .join(', ')
    return `Order #${order.orderNumber}: ${itemsStr}. Paid: Rs. ${roundCredit(paid)}`
  }

  const handlePrintKOT = () => {
    if (!order) return
    let tableInfo: string
    if (order.orderType === 'DELIVERY' && order.customerName) {
      tableInfo = `Delivery - ${order.customerName}${order.customerPhone ? ` | ${order.customerPhone}` : ''}${order.deliveryAddress ? ` | ${order.deliveryAddress}` : ''}`
    } else if (order.counterNumber != null) {
      tableInfo = `Counter #${order.counterNumber}`
    } else if (order.table) {
      tableInfo = `${order.table.code}${order.table.area?.name ? ` - ${order.table.area.name}` : ''}`
    } else {
      tableInfo = 'Takeaway'
    }
    const dateStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    const itemsRows = order.items
      .map(
        (item) =>
          `<tr><td>${item.menuItem.name}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">Rs. ${(item.price * item.quantity).toFixed(2)}</td></tr>`
      )
      .join('')
    const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KOT - Order #${order.orderNumber}</title>
  <style>
    body { font-family: sans-serif; max-width: 320px; margin: 16px auto; padding: 12px; }
    h1 { font-size: 18px; margin: 0 0 8px; text-align: center; }
    .meta { font-size: 12px; color: #444; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; border-bottom: 2px solid #000; padding: 6px 4px; }
    td { padding: 6px 4px; border-bottom: 1px solid #ddd; }
    .total { font-weight: bold; font-size: 16px; margin-top: 8px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>KITCHEN ORDER TICKET</h1>
  <div class="meta">
    <div>Order #${order.orderNumber}</div>
    <div>${tableInfo}</div>
    <div>${dateStr}</div>
    ${order.note ? `<div>Note: ${order.note}</div>` : ''}
  </div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="total">Total: Rs. ${total.toFixed(2)}</div>
</body>
</html>`
    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.left = '-9999px'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      showToast('Print failed', 'error')
      return
    }
    doc.open()
    doc.write(html)
    doc.close()
    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 100)
  }

  const handlePrintVatBill = async () => {
    if (!order || !isVatBill) return

    if (!vatName.trim()) {
      showToast('VAT Name is required', 'error')
      return
    }
    if (!vatPan.trim()) {
      showToast('VAT / PAN number is required', 'error')
      return
    }

    const restaurantName = 'Your Cafe Name'
    const restaurantAddress = 'Address not set'
    const restaurantVat = 'VAT No: N/A'

    let tableInfo: string
    if (order.orderType === 'DELIVERY' && order.customerName) {
      tableInfo = `Delivery - ${order.customerName}${order.customerPhone ? ` | ${order.customerPhone}` : ''}${order.deliveryAddress ? ` | ${order.deliveryAddress}` : ''}`
    } else if (order.counterNumber != null) {
      tableInfo = `Counter #${order.counterNumber}`
    } else if (order.table) {
      tableInfo = `${order.table.code}${order.table.area?.name ? ` - ${order.table.area.name}` : ''}`
    } else {
      tableInfo = 'Takeaway'
    }

    const dateStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const itemsRows = order.items
      .map(
        (item) =>
          `<tr>
            <td>${item.menuItem.name}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">Rs. ${item.price.toFixed(2)}</td>
            <td style="text-align:right">Rs. ${(item.price * item.quantity).toFixed(2)}</td>
          </tr>`
      )
      .join('')

    const subTotal = calculateSubTotal()
    const discountAmount = parseFloat(discount) || 0
    const total = calculateTotal()

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VAT Bill - Order #${order.orderNumber}</title>
  <style>
    body { font-family: sans-serif; max-width: 360px; margin: 16px auto; padding: 12px; }
    h1 { font-size: 18px; margin: 0 0 8px; text-align: center; }
    .restaurant { font-size: 12px; text-align: center; margin-bottom: 8px; }
    .restaurant div { margin: 2px 0; }
    .meta { font-size: 12px; color: #444; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; border-bottom: 2px solid #000; padding: 4px 3px; }
    td { padding: 4px 3px; border-bottom: 1px solid #ddd; }
    .summary { margin-top: 8px; font-size: 12px; }
    .summary-row { display: flex; justify-content: space-between; margin-top: 2px; }
    .summary-row.total { font-weight: bold; margin-top: 4px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="restaurant">
    <div><strong>${restaurantName}</strong></div>
    <div>${restaurantAddress}</div>
    <div>${restaurantVat}</div>
  </div>
  <h1>TAX INVOICE (VAT BILL)</h1>
  <div class="meta">
    <div>Order #${order.orderNumber}</div>
    <div>${tableInfo}</div>
    <div>${dateStr}</div>
    <div>VAT Name: ${vatName}</div>
    <div>PAN / VAT No: ${vatPan}</div>
    ${vatAddress ? `<div>Address: ${vatAddress}</div>` : ''}
    ${vatPhone ? `<div>Phone: ${vatPhone}</div>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="summary">
    <div class="summary-row">
      <span>Subtotal</span>
      <span>Rs. ${subTotal.toFixed(2)}</span>
    </div>
    ${
      discountAmount > 0
        ? `<div class="summary-row">
             <span>Discount</span>
             <span>- Rs. ${discountAmount.toFixed(2)}</span>
           </div>`
        : ''
    }
    <div class="summary-row">
      <span>VAT</span>
      <span>As applicable</span>
    </div>
    <div class="summary-row total">
      <span>Total</span>
      <span>Rs. ${total.toFixed(2)}</span>
    </div>
  </div>
</body>
</html>`

    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.left = '-9999px'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      showToast('Print failed', 'error')
      return
    }
    doc.open()
    doc.write(html)
    doc.close()
    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 100)
  }

  const calculateSubTotal = () => {
    if (!order) return 0
    return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  const calculateTotal = () => {
    const subTotal = calculateSubTotal()
    const discountAmount = parseFloat(discount) || 0
    return Math.max(0, subTotal - discountAmount)
  }

  /** Build items array for scope-aware discount (menuItemId, categoryId, price, quantity) */
  const getOrderItemsForDiscount = () => {
    if (!order) return []
    return order.items.map((item) => ({
      menuItemId: item.menuItem.id,
      categoryId: item.menuItem.categoryId ?? item.menuItem.category?.id ?? null,
      price: item.price,
      quantity: item.quantity,
    }))
  }

  /** Compute eligible subtotal from order items based on offer scope */
  const getEligibleSubTotal = (
    offer: { scope?: string; categoryIds?: string[] | null; menuItemIds?: string[] | null },
    items: Array<{ menuItemId: string; categoryId: string | null; price: number; quantity: number }>
  ) => {
    const scope = offer.scope || 'ALL'
    const categoryIds = offer.categoryIds || []
    const menuItemIds = offer.menuItemIds || []
    let eligible = 0
    for (const item of items) {
      let match = false
      if (scope === 'ALL') match = true
      else if (scope === 'CATEGORY' && item.categoryId && categoryIds.includes(item.categoryId)) match = true
      else if (scope === 'ITEM' && menuItemIds.includes(item.menuItemId)) match = true
      if (match) eligible += item.price * item.quantity
    }
    return eligible
  }

  const computeOfferDiscount = (
    offer: { type: string; value: number; minOrderAmount?: number | null; scope?: string; categoryIds?: string[] | null; menuItemIds?: string[] | null },
    orderItems: Array<{ menuItemId: string; categoryId: string | null; price: number; quantity: number }>
  ) => {
    const eligibleSubTotal = getEligibleSubTotal(offer, orderItems)
    if (offer.minOrderAmount != null && eligibleSubTotal < offer.minOrderAmount) return { amount: 0, eligibleSubTotal }
    const amount = offer.type === 'PERCENTAGE' ? (eligibleSubTotal * offer.value) / 100 : Math.min(offer.value, eligibleSubTotal)
    return { amount, eligibleSubTotal }
  }

  const handleApplyOfferByCode = async () => {
    if (!canBill) return
    if (!offerCode.trim()) {
      showToast('Enter offer code', 'error')
      return
    }
    const items = getOrderItemsForDiscount()
    try {
      const result = await discountsApi.applyWithOrder(offerCode.trim(), items)
      if (result && result.discountAmount != null) {
        setDiscount(result.discountAmount.toFixed(2))
        setAppliedOffer({
          name: result.offer.name,
          code: result.offer.code ?? undefined,
          eligibleSubTotal: result.eligibleSubTotal,
        })
        showToast(`Applied: ${result.offer.name}`, 'success')
      } else {
        showToast('Invalid or expired offer, or eligible total below minimum', 'error')
      }
    } catch (error: any) {
      showToast(error.message || 'Could not apply offer', 'error')
    }
  }

  const handleSelectOffer = (offer: typeof offers[0]) => {
    if (!canBill) return
    const items = getOrderItemsForDiscount()
    const { amount, eligibleSubTotal } = computeOfferDiscount(offer, items)
    setDiscount(amount.toFixed(2))
    setAppliedOffer({ name: offer.name, code: offer.code ?? undefined, eligibleSubTotal })
    if (amount > 0) showToast(`Applied: ${offer.name}`, 'success')
  }

  const handleClearOffer = () => {
    if (!canBill) return
    setDiscount('')
    setAppliedOffer(null)
    setOfferCode('')
  }

  const toggleItemServed = async (itemId: string, currentStatus?: string) => {
    if (!order || !canBill) return
    const nextStatus = currentStatus === 'SERVED' ? 'PENDING' : 'SERVED'

    // Optimistic update
    setOrder((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.id === itemId ? { ...it, status: nextStatus } : it
        ),
      }
    })

    // Also update the IndexedDB cache
    try {
      const cached = await db.orders.get(orderId)
      if (cached) {
        await db.orders.put({
          ...cached,
          items: cached.items.map((it: any) =>
            it.id === itemId ? { ...it, status: nextStatus } : it
          ),
        })
      }
    } catch {}

    try {
      await ordersApi.updateItemStatus(orderId, itemId, nextStatus)
    } catch (error: any) {
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                it.id === itemId ? { ...it, status: currentStatus } : it
              ),
            }
          : null
      )
      // Also rollback IndexedDB cache
      try {
        const cached = await db.orders.get(orderId)
        if (cached) {
          await db.orders.put({
            ...cached,
            items: cached.items.map((it: any) =>
              it.id === itemId ? { ...it, status: currentStatus } : it
            ),
          })
        }
      } catch {}
      showToast(error.message || 'Failed to update item status', 'error')
    }
  }

  const handleCompleteOrder = async () => {
    if (!order || !canBill) return

    if (isVatBill) {
      if (!vatName.trim()) {
        showToast('VAT Name is required', 'error')
        return
      }
      if (!vatPan.trim()) {
        showToast('VAT / PAN number is required', 'error')
        return
      }
    }

    const total = calculateTotal()
    const discountAmount = parseFloat(discount) || 0

    let paidTotal = 0
    if (paymentType === 'PARTIAL') {
      paidTotal = roundCredit(parseFloat(paidAmount) || 0)
      if (paidTotal < 0) {
        showToast('Paid amount must be 0 or more', 'error')
        return
      }
      if (paidTotal > total) {
        showToast('Paid amount cannot exceed order total', 'error')
        return
      }
      const creditTotal = roundCredit(total - paidTotal)
      if (creditTotal > 0) {
        if (creditorChoice === 'existing') {
          if (!selectedCreditorId) {
            showToast('Select a creditor for the credit amount', 'error')
            return
          }
        } else {
          if (!newCreditorName.trim()) {
            showToast('Enter creditor name to create', 'error')
            return
          }
        }
      }
    }

    const paymentData: any = {
      paymentType,
      discount: discountAmount > 0 ? discountAmount : undefined,
    }

    if (isVatBill) {
      paymentData.vatBill = {
        name: vatName.trim(),
        pan: vatPan.trim(),
        address: vatAddress.trim() || undefined,
        phone: vatPhone.trim() || undefined,
      }
    }

    if (paymentType === 'PARTIAL') {
      paidTotal = roundCredit(parseFloat(paidAmount) || 0)
      paymentData.payments = paidTotal > 0 ? [{ method: 'CASH', amount: paidTotal }] : []
    } else if (paymentType === 'BILL_SPLITTING') {
      paymentData.payments = []
      if (parseFloat(cashAmount) > 0) {
        paymentData.payments.push({
          method: 'CASH',
          amount: parseFloat(cashAmount),
        })
      }
      if (parseFloat(esewaAmount) > 0) {
        paymentData.payments.push({
          method: 'ESEWA',
          amount: parseFloat(esewaAmount),
        })
      }
    }

    const totalForCredit = calculateTotal()
    const paidForCredit = paymentType === 'PARTIAL' ? roundCredit(parseFloat(paidAmount) || 0) : 0
    const creditToAdd = roundCredit(totalForCredit - paidForCredit)
    const noteForCredit = buildCreditNote(paidForCredit)

    try {
      setSubmitting(true)
      showToast('Completing order…', 'info')

      await ordersApi.completeOrder(orderId, paymentData)

      // Cache the completed status
      try {
        const cached = await db.orders.get(orderId)
        if (cached) await db.orders.put({ ...cached, status: 'COMPLETED' })
      } catch {}

      if (paymentType === 'PARTIAL' && creditToAdd > 0) {
        let creditorId: string
        if (creditorChoice === 'new') {
          const created = await customersApi.createCustomer({
            name: newCreditorName.trim(),
            phone: newCreditorPhone.trim() || undefined,
            type: 'CREDITOR',
            creditBalance: 0,
          })
          creditorId = created.id
          await customersApi.updateCredit(creditorId, {
            amount: creditToAdd,
            type: 'CREDIT',
            note: noteForCredit,
          })
        } else {
          creditorId = selectedCreditorId
          await customersApi.updateCredit(creditorId, {
            amount: creditToAdd,
            type: 'CREDIT',
            note: noteForCredit,
          })
        }
      }

      showToast('Order completed successfully', 'success')
      router.push('/orders')
    } catch (error: any) {
      showToast(error.message || 'Failed to complete order', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!canBill) return
    const ok = await appConfirm({
      title: 'Cancel order',
      message: 'Are you sure you want to cancel this order?',
      confirmText: 'Cancel order',
      cancelText: 'Keep',
      destructive: true,
    })
    if (!ok) return

    // Optimistic: update local state and IndexedDB immediately
    setOrder((prev) => prev ? { ...prev, status: 'CANCELLED' } : null)
    try {
      const cached = await db.orders.get(orderId)
      if (cached) await db.orders.put({ ...cached, status: 'CANCELLED' })
    } catch {}
    
    showToast('Order cancelled', 'success')
    router.push('/orders')
    
    // Sync to server in background
    ordersApi.updateOrderStatus(orderId, 'CANCELLED').catch(async () => {
      // Rollback on failure
      try {
        const cached = await db.orders.get(orderId)
        if (cached) await db.orders.put({ ...cached, status: 'PENDING' })
      } catch {}
    })
  }

  if (loading || !order) {
    return <Loading />
  }

  const subTotal = calculateSubTotal()
  const total = calculateTotal()
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const partialCreditAmount = roundCredit(Math.max(0, total - (parseFloat(paidAmount) || 0)))
  const partialCreditorOk =
    partialCreditAmount === 0 ||
    (creditorChoice === 'existing' && selectedCreditorId) ||
    (creditorChoice === 'new' && newCreditorName.trim())
  const canCompletePartial = paymentType !== 'PARTIAL' || partialCreditorOk

  const servedCount = order.items.reduce(
    (sum, item) => sum + (item.status === 'SERVED' ? item.quantity : 0),
    0
  )
  const serveState =
    servedCount === 0
      ? 'Unserved'
      : servedCount === totalItems
        ? 'Served'
        : 'Partially Served'

  return (
    <div className="min-h-full bg-gray-50 pb-24 sm:pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 min-h-[56px]">
          <button
            type="button"
            onClick={() => router.back()}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1 text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate flex-1 text-center mx-2">Order Billing</h1>
          <div className="w-11 min-w-[44px]" />
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-4">
        {/* Order Header */}
        {order.orderType === 'DELIVERY' && (order.customerName || order.deliveryAddress) ? (
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Delivery</p>
            <p className="text-xs text-gray-500 mb-1">
              Payment: {order.paymentMode === 'CASH' ? 'Cash On Delivery' : order.paymentMode === 'CARD' ? 'Prepaid' : order.paymentMode}
            </p>
            {order.customerName && <p className="text-sm text-gray-700">{order.customerName}</p>}
            {order.customerPhone && <p className="text-xs text-gray-600">{order.customerPhone}</p>}
            {order.deliveryAddress && <p className="text-xs text-gray-600 mt-1">{order.deliveryAddress}</p>}
            {order.note && (
              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-gray-100">
                Note: {order.note}
              </p>
            )}
          </div>
        ) : order.counterNumber != null ? (
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Counter #{order.counterNumber}</p>
            <p className="text-xs text-gray-600 mt-1">Serve status: {serveState}</p>
            {order.note && (
              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-gray-100">
                Note: {order.note}
              </p>
            )}
          </div>
        ) : order.table ? (
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-900">
              {order.table.code} - {order.table.area?.name || ''}
            </p>
            <p className="text-xs text-gray-600 mt-1">Serve status: {serveState}</p>
            {order.note && (
              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-gray-100">
                Note: {order.note}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Takeaway</p>
            {order.note && (
              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-gray-100">
                Note: {order.note}
              </p>
            )}
          </div>
        )}

        {/* Order Items List with serve/unserve controls */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="space-y-3">
            {order.items.map((item) => {
              const isServed = item.status === 'SERVED'
              const imageUrl = getItemDisplayImage(
                item.menuItem,
                item.menuItem.category ?? undefined
              )
              return (
                <div key={item.id} className="flex items-center gap-3 pb-3 border-b last:border-0">
                  {imageUrl ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={imageUrl}
                        alt={item.menuItem.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                      No img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.menuItem.name}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Rs. {item.price.toFixed(2)} x {item.quantity}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isServed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isServed ? 'Served' : 'Pending'}
                      </span>
                      {canBill && (
                        <button
                          type="button"
                          onClick={() => toggleItemServed(item.id, item.status)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            isServed
                              ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                              : 'text-white bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {isServed ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              Undo
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Mark Served
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900 min-w-[70px] text-right">
                      Rs. {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Print KOT / VAT Bill */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handlePrintKOT}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700"
          >
            Print KOT
          </button>
          {isVatBill && (
            <button
              type="button"
              onClick={handlePrintVatBill}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700"
            >
              Print VAT Bill
            </button>
          )}
        </div>

        {/* Apply Offer */}
        <div className="bg-white rounded-lg p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Apply offer</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={offerCode}
              onChange={(e) => canBill && setOfferCode(e.target.value.toUpperCase())}
              placeholder="Offer code (e.g. SAVE10)"
              disabled={!canBill}
              className={`flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-700 ${!canBill ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-gray-600'}`}
            />
            <button
              type="button"
              onClick={handleApplyOfferByCode}
              disabled={!canBill}
              className={`px-4 py-2.5 rounded-lg font-medium ${canBill ? 'bg-slate-100 text-slate-800 hover:bg-slate-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              Apply
            </button>
          </div>
          {offers.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-2">Or select an offer:</p>
              <div className="flex flex-wrap gap-2">
                {offers.map((offer) => {
                  const items = getOrderItemsForDiscount()
                  const { eligibleSubTotal } = computeOfferDiscount(offer, items)

                  // For scope-restricted offers (CATEGORY / ITEM), require at least one matching item
                  // so coupons that don't apply to this order are not clickable.
                  const hasEligibleItems = eligibleSubTotal > 0
                  const meetsMin =
                    hasEligibleItems &&
                    (offer.minOrderAmount == null || eligibleSubTotal >= offer.minOrderAmount)

                  return (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => canBill && meetsMin && handleSelectOffer(offer)}
                      disabled={!canBill || !meetsMin}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        canBill && meetsMin
                          ? 'bg-red-100 text-red-800 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {offer.code || offer.name}{' '}
                      {offer.type === 'PERCENTAGE' ? `(${offer.value}%)` : `(Rs.${offer.value})`}
                      {offer.scope && offer.scope !== 'ALL' && ` [${offer.scope}]`}
                      {!hasEligibleItems && offer.scope && offer.scope !== 'ALL' && ' (not for these items)'}
                      {!meetsMin && offer.minOrderAmount != null && hasEligibleItems && ` (min Rs.${offer.minOrderAmount})`}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {appliedOffer && (
            <div className="flex flex-col gap-1 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
              <div className="flex items-center justify-between">
                <span>Applied: {appliedOffer.name}{appliedOffer.code ? ` (${appliedOffer.code})` : ''}</span>
                {canBill && (
                  <button type="button" onClick={handleClearOffer} className="font-medium hover:underline">
                    Remove
                  </button>
                )}
              </div>
              {appliedOffer.eligibleSubTotal != null && appliedOffer.eligibleSubTotal !== subTotal && (
                <span className="text-xs">Discount on eligible items: Rs. {appliedOffer.eligibleSubTotal.toFixed(2)}</span>
              )}
            </div>
          )}
        </div>

        {/* Discount amount (manual or from offer) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Discount amount (Rs.)</label>
          <input
            type="text"
            inputMode="decimal"
            value={discount}
            onChange={(e) => {
              if (!canBill) return
              setDiscount(e.target.value)
              if (appliedOffer) setAppliedOffer(null)
            }}
            disabled={!canBill}
            placeholder="Or enter discount amount manually"
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent ${!canBill ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-gray-600 bg-gray-50'}`}
          />
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          {!canBill && (
            <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-4">
              Billing is locked — this order can only be viewed.
            </p>
          )}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Total Items({totalItems})</span>
              <span className="font-medium text-gray-900">Rs. {subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Sub Total</span>
              <span className="font-medium text-gray-900">Rs. {subTotal.toFixed(2)}</span>
            </div>
            {parseFloat(discount) > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount</span>
                <span>- Rs. {parseFloat(discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">Rs. {total.toFixed(2)}</span>
            </div>
            {paymentType === 'PARTIAL' && (
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-gray-700">Credit (rest to creditor)</span>
                <span className="font-medium text-amber-700">
                  Rs. {partialCreditAmount}
                </span>
              </div>
            )}
          </div>

          <div className="border-t pt-3 mt-2 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 text-red-700 border-gray-300 rounded"
                checked={isVatBill}
                onChange={(e) => setIsVatBill(e.target.checked)}
              />
              <span>Issue VAT Bill</span>
            </label>

            {isVatBill && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    VAT Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vatName}
                    onChange={(e) => setVatName(e.target.value)}
                    placeholder="Enter VAT name"
                    className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PAN / VAT Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vatPan}
                    onChange={(e) => setVatPan(e.target.value)}
                    placeholder="Enter PAN / VAT number"
                    className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
                  <input
                    type="text"
                    value={vatAddress}
                    onChange={(e) => setVatAddress(e.target.value)}
                    placeholder="Enter address"
                    className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number (optional)</label>
                  <input
                    type="tel"
                    value={vatPhone}
                    onChange={(e) => setVatPhone(e.target.value)}
                    placeholder="Enter contact number"
                    className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Type Selection - stacked on mobile, grid on tablet+ */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Type</h3>
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3">
            <button
              type="button"
              onClick={() => canBill && setPaymentType('FULL')}
              disabled={!canBill}
              className={`min-h-[44px] py-2.5 px-3 rounded-lg text-sm font-medium ${
                paymentType === 'FULL'
                  ? 'bg-red-700 text-white'
                  : canBill
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Full
            </button>
            <button
              type="button"
              onClick={() => canBill && setPaymentType('BILL_SPLITTING')}
              disabled={!canBill}
              className={`min-h-[44px] py-2.5 px-3 rounded-lg text-sm font-medium ${
                paymentType === 'BILL_SPLITTING'
                  ? 'bg-red-700 text-white'
                  : canBill
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Bill Splitting
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canBill) return
                setPaymentType('PARTIAL')
                setPaidAmount('')
                setSelectedCreditorId('')
                setNewCreditorName('')
                setNewCreditorPhone('')
                setCreditorChoice('existing')
              }}
              disabled={!canBill}
              className={`min-h-[44px] py-2.5 px-3 rounded-lg text-sm font-medium ${
                paymentType === 'PARTIAL'
                  ? 'bg-red-700 text-white'
                  : canBill
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Partial Payment
            </button>
          </div>

          {/* Payment Method Inputs (for Bill Splitting) */}
          {paymentType === 'BILL_SPLITTING' && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => {
                    setCashAmount(e.target.value)
                    const cash = parseFloat(e.target.value) || 0
                    const esewa = parseFloat(esewaAmount) || 0
                    const remaining = total - cash - esewa
                    setCreditAmount(Math.max(0, remaining).toFixed(2))
                  }}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">esewa</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={esewaAmount}
                  onChange={(e) => {
                    setEsewaAmount(e.target.value)
                    const cash = parseFloat(cashAmount) || 0
                    const esewa = parseFloat(e.target.value) || 0
                    const remaining = total - cash - esewa
                    setCreditAmount(Math.max(0, remaining).toFixed(2))
                  }}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700"
                />
              </div>
            </div>
          )}

          {/* Partial Payment: paid amount + creditor for rest */}
          {paymentType === 'PARTIAL' && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paid amount (Rs.) – whole numbers only
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Rest (Rs. {partialCreditAmount}) will be added as credit to the creditor below.
                </p>
              </div>

              {partialCreditAmount > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add credit to creditor
                    </label>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setCreditorChoice('existing')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                          creditorChoice === 'existing'
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        Select existing
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreditorChoice('new')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                          creditorChoice === 'new'
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        Create new
                      </button>
                    </div>

                    {creditorChoice === 'existing' ? (
                      <div>
                        {creditorsLoading ? (
                          <p className="text-sm text-gray-500">Loading creditors…</p>
                        ) : creditors.length === 0 ? (
                          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                            No creditors yet. Create one below or add from Customers &amp; Creditors.
                          </p>
                        ) : (
                          <select
                            value={selectedCreditorId}
                            onChange={(e) => setSelectedCreditorId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700"
                          >
                            <option value="">Select creditor</option>
                            {creditors.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} (Rs. {roundCredit(c.creditBalance)})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newCreditorName}
                          onChange={(e) => setNewCreditorName(e.target.value)}
                          placeholder="Creditor name *"
                          className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700"
                        />
                        <input
                          type="text"
                          inputMode="tel"
                          value={newCreditorPhone}
                          onChange={(e) => setNewCreditorPhone(e.target.value)}
                          placeholder="Phone (optional)"
                          className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-700"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    Order items and paid amount will be saved in the creditor note for this credit.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleCompleteOrder}
            disabled={!canBill || submitting || !canCompletePartial}
            className={`w-full py-3 rounded-lg font-medium ${canBill && canCompletePartial ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'} disabled:opacity-50`}
          >
            {submitting ? 'Completing...' : 'Complete Order'}
          </button>
          <button
            onClick={handleCancelOrder}
            disabled={!canBill}
            className={`w-full border-2 py-3 rounded-lg font-medium ${canBill ? 'border-red-600 text-red-600 hover:bg-red-50' : 'border-gray-300 text-gray-400 cursor-not-allowed'}`}
          >
            Cancel Order
          </button>
        </div>
      </div>
    </div>
  )
}
