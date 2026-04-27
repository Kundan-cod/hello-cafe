// Use NEXT_PUBLIC_API_URL when set. Otherwise, when opened from mobile/LAN (e.g. 192.168.1.66:3000),
// use the same host with port 3001 so the API is reachable without changing .env.
export function getApiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:3001`
    }
  }
  return 'http://localhost:3001'
}

/** Standard auth headers for API requests. */
export function getApiHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenantId) headers['X-Tenant-Id'] = tenantId
  return headers
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

type FetchApiOptions = RequestInit

async function fetchApi(
  endpoint: string,
  options: FetchApiOptions = {}
): Promise<any> {
  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers: { ...getApiHeaders(), ...(options.headers as Record<string, string>) },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }))
    throw new ApiError(response.status, error.message || 'Request failed')
  }

  // Some endpoints can intentionally return no body (e.g. 204 / empty 200).
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// Auth types
type RegisterPayload = {
  cafeName: string
  name: string
  email: string
  password: string
  contactNumber?: string
  province?: string
  district?: string
  location?: string
  brandPrimaryColor?: string
  brandSecondaryColor?: string
  orderManagementType?: string
  panNumber?: string
  planType?: 'TRIAL' | 'PAID'
}

// Auth API
export const authApi = {
  register: (data: RegisterPayload) =>
    fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (email: string, password: string) =>
    fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  forgotPassword: (email: string) =>
    fetchApi('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  /**
   * Dedicated admin login that checks credentials on the server
   * against env vars (ADMIN_USERNAME / ADMIN_PASSWORD).
   */
  adminLogin: (username: string, password: string) =>
    fetchApi('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  setPassword: (newPassword: string) =>
    fetchApi('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  getProfile: () => fetchApi('/auth/profile'),

  updateProfile: (data: {
    currentPassword?: string
    newPassword?: string
    panNumber?: string
    contactNumber?: string
    name?: string
  }) =>
    fetchApi('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}

// Admin API (global, env-based admin)
export const adminApi = {
  getUsers: () => fetchApi('/admin/users'),
  setUserTempPassword: (id: string, tempPassword: string) =>
    fetchApi(`/admin/users/${id}/set-temp-password`, {
      method: 'POST',
      body: JSON.stringify({ tempPassword }),
    }),
}

// Menu API
export const menuApi = {
  getCategories: () => fetchApi('/menu/category'),
  getCategory: (id: string) => fetchApi(`/menu/category/${id}`),
  createCategory: (data: { name: string; imageUrl?: string }) =>
    fetchApi('/menu/category', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: { name?: string; imageUrl?: string }) =>
    fetchApi(`/menu/category/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    fetchApi(`/menu/category/${id}`, { method: 'DELETE' }),
  
  getItems: () => fetchApi('/menu/item'),
  getItem: (id: string) => fetchApi(`/menu/item/${id}`),
  createItem: (data: { name: string; price: number; categoryId: string; imageUrl?: string }) =>
    fetchApi('/menu/item', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: string, data: {
    name?: string
    price?: number
    categoryId?: string
    imageUrl?: string
  }) =>
    fetchApi(`/menu/item/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteItem: (id: string) =>
    fetchApi(`/menu/item/${id}`, { method: 'DELETE' }),
}

// Orders API
export type GetOrdersOpts = {
  cursor?: string | null
  limit?: number
  status?: 'IN_PROCESS' | 'COMPLETED' | 'CREDIT' | 'CANCELLED'
  orderType?: 'DELIVERY'
  search?: string
}

export const ordersApi = {
  getOrders: (branchId?: string | null, opts?: GetOrdersOpts) => {
    const params = new URLSearchParams()
    if (branchId != null && branchId !== '') params.set('branchId', branchId)
    if (opts?.cursor) params.set('cursor', opts.cursor)
    if (opts?.limit != null) params.set('limit', String(opts.limit))
    if (opts?.status) params.set('status', opts.status)
    if (opts?.orderType) params.set('orderType', opts.orderType)
    if (opts?.search?.trim()) params.set('search', opts.search.trim())
    const qs = params.toString()
    return fetchApi(`/orders${qs ? `?${qs}` : ''}`)
  },

  getOrdersStatus: (branchId?: string | null) =>
    fetchApi(
      branchId != null && branchId !== ''
        ? `/orders/status?branchId=${encodeURIComponent(branchId)}`
        : '/orders/status'
    ),

  getOrder: (id: string) => fetchApi(`/orders/${id}`),
  
  createOrder: (data: {
    paymentMode: 'CASH' | 'QR' | 'CARD'
    orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
    tableId?: string
    counterNumber?: string
    note?: string
    customerName?: string
    customerPhone?: string
    deliveryAddress?: string
    items: Array<{ menuItemId: string; quantity: number }>
  }) => fetchApi('/orders?lite=1', { method: 'POST', body: JSON.stringify(data) }),

  addItems: (
    id: string,
    data: {
      items: Array<{ menuItemId: string; quantity: number }>
    }
  ) =>
    fetchApi(`/orders/${id}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateItemStatus: (
    orderId: string,
    itemId: string,
    status: 'PENDING' | 'SERVED'
  ) =>
    fetchApi(`/orders/${orderId}/items/${itemId}/status?lite=1`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  updateItemQuantity: (orderId: string, itemId: string, quantity: number) =>
    fetchApi(`/orders/${orderId}/items/${itemId}?lite=1`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),

  removeOrderItem: (orderId: string, itemId: string) =>
    fetchApi(`/orders/${orderId}/items/${itemId}?lite=1`, { method: 'DELETE' }),

  updateOrderStatus: (id: string, status: string) =>
    fetchApi(`/orders/${id}/status?lite=1`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  completeOrder: (id: string, data: {
    discount?: number
    paymentType: 'FULL' | 'BILL_SPLITTING' | 'PARTIAL'
    payments?: Array<{ method: string; amount: number }>
    vatBill?: {
      name: string
      pan: string
      address?: string
      phone?: string
    }
  }) =>
    fetchApi(`/orders/${id}/complete?lite=1`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Tenant API (cafe settings)
export const tenantApi = {
  getMe: (branchId?: string | null) =>
    fetchApi(
      branchId ? `/tenant/me?branchId=${encodeURIComponent(branchId)}` : '/tenant/me'
    ),
  updateMe: (data: { orderManagementType: 'TABLE_BASED' | 'COUNTER_BASED' | 'BOTH' }) =>
    fetchApi('/tenant/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}

// Areas API
export const areasApi = {
  getAreas: () => fetchApi('/areas'),
  getArea: (id: string) => fetchApi(`/areas/${id}`),
  createArea: (data: { name: string; description?: string }) =>
    fetchApi('/areas', { method: 'POST', body: JSON.stringify(data) }),
  updateArea: (id: string, data: { name?: string; description?: string }) =>
    fetchApi(`/areas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteArea: (id: string) => fetchApi(`/areas/${id}`, { method: 'DELETE' }),
}

// Tables API
export const tablesApi = {
  getTables: () => fetchApi('/tables'),
  getTable: (id: string) => fetchApi(`/tables/${id}`),
  createTable: (data: { code: string; areaId: string; capacity: number }) =>
    fetchApi('/tables', { method: 'POST', body: JSON.stringify(data) }),
  updateTable: (id: string, data: {
    code?: string
    areaId?: string
    capacity?: number
    status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'
  }) =>
    fetchApi(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTable: (id: string) => fetchApi(`/tables/${id}`, { method: 'DELETE' }),
}
 
// Combos API
export const combosApi = {
  getCombos: () => fetchApi('/combos'),
  getCombo: (id: string) => fetchApi(`/combos/${id}`),
  createCombo: (data: {
    name: string
    price: number
    description?: string
    imageUrl?: string
    // Prefer storing both menuItemId and name; name is required, menuItemId optional for now.
    items?: Array<{ name: string; menuItemId?: string }>
  }) => fetchApi('/combos', { method: 'POST', body: JSON.stringify(data) }),
  updateCombo: (
    id: string,
    data: {
      name?: string
      price?: number
      description?: string
      imageUrl?: string
      items?: Array<{ name: string; menuItemId?: string }>
    }
  ) => fetchApi(`/combos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCombo: (id: string) => fetchApi(`/combos/${id}`, { method: 'DELETE' }),
}

// Customers & Creditors API
export const customersApi = {
  getCustomers: (type?: 'CUSTOMER' | 'CREDITOR') =>
    fetchApi(type ? `/customers?type=${type}` : '/customers'),
  getCustomer: (id: string) => fetchApi(`/customers/${id}`),
  getCreditHistory: (id: string) =>
    fetchApi(`/customers/${id}/credit-history`),
  createCustomer: (data: {
    name: string
    phone?: string
    email?: string
    address?: string
    notes?: string
    type?: 'CUSTOMER' | 'CREDITOR'
    creditBalance?: number
  }) => fetchApi('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (
    id: string,
    data: {
      name?: string
      phone?: string
      email?: string
      address?: string
      notes?: string
      type?: 'CUSTOMER' | 'CREDITOR'
      creditBalance?: number
    }
  ) => fetchApi(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateCredit: (
    id: string,
    data: { amount: number; type: 'PAYMENT' | 'CREDIT'; note?: string }
  ) =>
    fetchApi(`/customers/${id}/credit`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCustomer: (id: string) => fetchApi(`/customers/${id}`, { method: 'DELETE' }),
}

// Staff API
export const staffApi = {
  getBranchesForSelect: () => fetchApi('/staff/branches-options'),
  getStaff: (branchId?: string | null, role?: 'STAFF' | 'BRANCH_OWNER') => {
    const params = new URLSearchParams()
    if (branchId != null && branchId !== '') params.set('branchId', branchId)
    if (role) params.set('role', role)
    return fetchApi(`/staff${params.toString() ? `?${params}` : ''}`)
  },
  getStaffById: (id: string) => fetchApi(`/staff/${id}`),
  createStaff: (data: {
    name: string
    email: string
    contactNumber: string
    role: 'STAFF' | 'BRANCH_OWNER'
    panNumber?: string
    citizenshipNumber?: string
    salary?: number
    shiftStart?: string
    shiftEnd?: string
    branchId?: string
    /** Optional custom temporary password set by owner/branch owner. */
    tempPassword?: string
  }) => fetchApi('/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id: string, data: {
    name?: string
    email?: string
    contactNumber?: string
    role?: 'STAFF' | 'BRANCH_OWNER'
    panNumber?: string
    citizenshipNumber?: string
    salary?: number
    shiftStart?: string
    shiftEnd?: string
    branchId?: string | null
    isActive?: boolean
  }) => fetchApi(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStaff: (id: string) => fetchApi(`/staff/${id}`, { method: 'DELETE' }),
}

// Branches API (main owner only)
export const branchesApi = {
  getBranches: () => fetchApi('/branches'),
  getBranch: (id: string) => fetchApi(`/branches/${id}`),
  createBranch: (data: {
    branchLocation: string
    branchAdmin: string
    emailId: string
    province?: string
    district?: string
    contactNumber?: string
    /** Optional custom temporary password set by owner for branch admin. */
    tempPassword?: string
  }) =>
    fetchApi('/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (
    id: string,
    data: {
      branchLocation?: string
      branchAdmin?: string
      emailId?: string
      province?: string
      district?: string
      contactNumber?: string
    }
  ) =>
    fetchApi(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBranch: (id: string) =>
    fetchApi(`/branches/${id}`, { method: 'DELETE' }),
}

// Discounts & Offers API
export type DiscountScope = 'ALL' | 'CATEGORY' | 'ITEM'

export const discountsApi = {
  getDiscounts: (activeOnly: boolean = true) =>
    fetchApi(activeOnly ? '/discounts?activeOnly=true' : '/discounts'),
  getActiveForOrder: () => fetchApi('/discounts/for-order'),
  applyByCode: (code: string, subTotal: number) =>
    fetchApi(`/discounts/apply?code=${encodeURIComponent(code)}&subTotal=${subTotal}`),
  applyWithOrder: (
    code: string,
    items: Array<{ menuItemId: string; categoryId: string | null; price: number; quantity: number }>
  ) =>
    fetchApi('/discounts/apply', {
      method: 'POST',
      body: JSON.stringify({ code, items }),
    }),
  getDiscount: (id: string) => fetchApi(`/discounts/${id}`),
  createDiscount: (data: {
    name: string
    code?: string
    type: 'PERCENTAGE' | 'FIXED_AMOUNT'
    value: number
    scope?: DiscountScope
    categoryIds?: string[]
    menuItemIds?: string[]
    minOrderAmount?: number
    validFrom?: string
    validTo?: string
  }) => fetchApi('/discounts', { method: 'POST', body: JSON.stringify(data) }),
  updateDiscount: (
    id: string,
    data: {
      name?: string
      code?: string
      type?: 'PERCENTAGE' | 'FIXED_AMOUNT'
      value?: number
      scope?: DiscountScope
      categoryIds?: string[] | null
      menuItemIds?: string[] | null
      minOrderAmount?: number
      validFrom?: string | null
      validTo?: string | null
      isActive?: boolean
    }
  ) => fetchApi(`/discounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDiscount: (id: string) => fetchApi(`/discounts/${id}`, { method: 'DELETE' }),
}

// Billing & Subscription API
export const billingApi = {
  /** List all active plans for the current cafe to choose from. */
  getPlans: () => fetchApi('/plans'),

  /**
   * Submit a manual QR payment for verification.
   * Backend expects: { planId, transactionId, paidAmount, screenshotUrl? }.
   */
  requestSubscription: (data: {
    planId: string
    transactionId: string
    paidAmount: number
    screenshotUrl?: string
  }) =>
    fetchApi('/subscriptions/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Admin-only: list all pending subscription payment requests. */
  getPendingSubscriptions: () =>
    fetchApi('/admin/subscriptions/pending'),

  /** Admin-only: approve a pending subscription. */
  approveSubscription: (id: string) =>
    fetchApi(`/admin/subscriptions/${id}/approve`, {
      method: 'POST',
    }),

  /** Admin-only: reject a pending subscription with a note. */
  rejectSubscription: (id: string, note: string) =>
    fetchApi(`/admin/subscriptions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  /** Tenant: get the latest subscription (pending/active) for current cafe. */
  getMySubscription: () => fetchApi('/subscriptions/me'),
}

// Vendors API
export type VendorPurchaseItemDto = {
  productName: string
  quantity: number
  unitPrice: number
  inventoryProductId?: string
}

export const vendorsApi = {
  getVendors: () => fetchApi('/vendors'),
  getVendor: (id: string) => fetchApi(`/vendors/${id}`),
  createVendor: (data: {
    name: string
    phone?: string
    email?: string
    address?: string
    notes?: string
  }) => fetchApi('/vendors', { method: 'POST', body: JSON.stringify(data) }),
  updateVendor: (
    id: string,
    data: {
      name?: string
      phone?: string
      email?: string
      address?: string
      notes?: string
    }
  ) => fetchApi(`/vendors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVendor: (id: string) => fetchApi(`/vendors/${id}`, { method: 'DELETE' }),
  createPurchase: (
    vendorId: string,
    data: {
      totalAmount: number
      paidAmount: number
      note?: string
      items: VendorPurchaseItemDto[]
    }
  ) =>
    fetchApi(`/vendors/${vendorId}/purchases`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPurchaseHistory: (vendorId: string) =>
    fetchApi(`/vendors/${vendorId}/purchases`),
  getPurchase: (vendorId: string, purchaseId: string) =>
    fetchApi(`/vendors/${vendorId}/purchases/${purchaseId}`),
  updatePurchasePayment: (
    vendorId: string,
    purchaseId: string,
    data: { paidAmount: number; note?: string }
  ) =>
    fetchApi(`/vendors/${vendorId}/purchases/${purchaseId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}

// Inventory API
export const inventoryApi = {
  getProducts: () => fetchApi('/inventory'),
  getProduct: (id: string) => fetchApi(`/inventory/${id}`),
  createProduct: (data: { name: string; unit: string }) =>
    fetchApi('/inventory', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (
    id: string,
    data: { name?: string; unit?: string }
  ) =>
    fetchApi(`/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => fetchApi(`/inventory/${id}`, { method: 'DELETE' }),
  addStock: (productId: string, data: { quantity: number; note?: string }) =>
    fetchApi(`/inventory/${productId}/stock`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getStockHistory: (productId: string, limit?: number) => {
    const q = limit != null ? `?limit=${limit}` : ''
    return fetchApi(`/inventory/${productId}/history${q}`)
  },
  getMenuItemUsages: (menuItemId: string) =>
    fetchApi(`/inventory/usage/menu-item/${menuItemId}`),
  setMenuItemUsages: (
    menuItemId: string,
    usages: Array<{ inventoryProductId: string; quantityPerUnit: number }>
  ) =>
    fetchApi(`/inventory/usage/menu-item/${menuItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ usages }),
    }),
  /** Set which menu items use this inventory product (replaces only this product's links). */
  setProductMenuLinks: (
    productId: string,
    links: Array<{ menuItemId: string; quantityPerUnit: number }>
  ) =>
    fetchApi(`/inventory/${productId}/usage`, {
      method: 'PUT',
      body: JSON.stringify({ links }),
    }),
}
