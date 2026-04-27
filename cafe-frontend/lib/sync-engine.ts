import { db } from './db'
import {
  menuApi, areasApi, tablesApi, combosApi, customersApi,
  branchesApi, discountsApi, vendorsApi, inventoryApi, tenantApi,
  getApiHeaders, getApiBaseUrl,
} from './api'

type StoreConfig = {
  storeName: string
  fetchFn: () => Promise<any>
}

const storeConfigs: StoreConfig[] = [
  { storeName: 'menuCategories', fetchFn: menuApi.getCategories },
  { storeName: 'menuItems', fetchFn: menuApi.getItems },
  { storeName: 'areas', fetchFn: areasApi.getAreas },
  { storeName: 'dineTables', fetchFn: tablesApi.getTables },
  { storeName: 'combos', fetchFn: combosApi.getCombos },
  { storeName: 'customers', fetchFn: customersApi.getCustomers },
  { storeName: 'branches', fetchFn: branchesApi.getBranches },
  { storeName: 'discounts', fetchFn: () => discountsApi.getDiscounts(false) },
  { storeName: 'vendors', fetchFn: vendorsApi.getVendors },
  { storeName: 'inventoryProducts', fetchFn: inventoryApi.getProducts },
]

/**
 * Pull a single store's data from the server and replace the local table.
 * Preserves any items with temporary IDs (pending optimistic creates that
 * haven't synced yet) so they aren't lost during a background refresh.
 */
export async function pullStore(
  storeName: string,
  fetchFn: () => Promise<any>,
): Promise<void> {
  try {
    const data = await fetchFn()
    const items = Array.isArray(data) ? data : []
    await db.transaction('rw', db.table(storeName), db.syncMeta, async () => {
      const pending = await db.table(storeName)
        .filter((item: any) => typeof item.id === 'string' && item.id.startsWith('_temp_'))
        .toArray()
      await db.table(storeName).clear()
      if (items.length > 0) {
        await db.table(storeName).bulkPut(items)
      }
      if (pending.length > 0) {
        await db.table(storeName).bulkPut(pending)
      }
      await db.syncMeta.put({ storeName, lastSyncedAt: Date.now() })
    })
  } catch (err) {
    console.warn(`[sync] Failed to pull ${storeName}:`, err)
  }
}

/**
 * Pull all registered stores from the server in parallel.
 */
export async function pullAll(): Promise<void> {
  await Promise.allSettled(
    storeConfigs.map(({ storeName, fetchFn }) => pullStore(storeName, fetchFn)),
  )
}

/**
 * Pull tenant settings (single object, not array).
 */
export async function pullTenant(branchId?: string | null): Promise<void> {
  try {
    const data = await tenantApi.getMe(branchId)
    if (data?.id) {
      await db.tenant.put(data)
    }
  } catch (err) {
    console.warn('[sync] Failed to pull tenant:', err)
  }
}

/**
 * Process the outbox queue: replay failed mutations against the server.
 * Handles reconciliation for optimistic creates (temp ID replacement),
 * and rollback for updates/deletes that the server rejected.
 */
export async function processOutbox(): Promise<void> {
  const entries = await db.syncQueue.toArray()
  for (const entry of entries) {
    try {
      const resp = await fetch(`${getApiBaseUrl()}${entry.endpoint}`, {
        method: entry.method,
        headers: getApiHeaders(),
        body: entry.body || undefined,
      })

      if (resp.ok) {
        // Reconcile optimistic create: replace temp item with server version
        if (entry.storeName && entry.tempId) {
          try {
            const text = await resp.text()
            const result = text ? JSON.parse(text) : null
            await db.table(entry.storeName).delete(entry.tempId).catch(() => {})
            if (result?.id) await db.table(entry.storeName).put(result)
          } catch {}
        }
        await db.syncQueue.delete(entry.id)
      } else if (resp.status >= 400 && resp.status < 500) {
        // Client/validation error — rollback local changes
        if (entry.storeName) {
          if (entry.tempId) {
            await db.table(entry.storeName).delete(entry.tempId).catch(() => {})
          }
          if (entry.rollbackData) {
            try { await db.table(entry.storeName).put(JSON.parse(entry.rollbackData)) } catch {}
          }
        }
        await db.syncQueue.delete(entry.id)
      } else if ((entry.retries || 0) >= 5) {
        // Max retries — rollback
        if (entry.storeName) {
          if (entry.tempId) await db.table(entry.storeName).delete(entry.tempId).catch(() => {})
          if (entry.rollbackData) {
            try { await db.table(entry.storeName).put(JSON.parse(entry.rollbackData)) } catch {}
          }
        }
        await db.syncQueue.delete(entry.id)
      } else {
        await db.syncQueue.update(entry.id, { retries: (entry.retries || 0) + 1 })
      }
    } catch {
      break
    }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null
let onlineHandler: (() => void) | null = null

/**
 * Start background sync: initial pull + periodic refresh + process outbox.
 */
export function startBackgroundSync(intervalMs = 30000): void {
  pullAll()
  const branchId = typeof window !== 'undefined' ? localStorage.getItem('branchId') : null
  pullTenant(branchId)

  if (intervalId) clearInterval(intervalId)
  intervalId = setInterval(() => {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      pullAll()
      processOutbox()
    }
  }, intervalMs)

  if (typeof window !== 'undefined') {
    if (onlineHandler) window.removeEventListener('online', onlineHandler)
    onlineHandler = () => {
      pullAll()
      processOutbox()
    }
    window.addEventListener('online', onlineHandler)
  }
}

export function stopBackgroundSync(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (typeof window !== 'undefined' && onlineHandler) {
    window.removeEventListener('online', onlineHandler)
    onlineHandler = null
  }
}

/**
 * Clear all data from every local table (e.g. on logout).
 */
export async function clearAllLocalData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
    }
  })
}

export { storeConfigs }
