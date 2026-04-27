import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { db } from './db'
import { pullStore } from './sync-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTempId(): string {
  return `_temp_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (err instanceof TypeError) return true
  const e = err as Record<string, any> | null
  return e?.name === 'TypeError'
}

// ---------------------------------------------------------------------------
// Hooks — live-updating reads from IndexedDB
// ---------------------------------------------------------------------------

/**
 * Returns all items from a local IndexedDB table as a live-updating array.
 *
 * On mount, triggers a background refresh from the server so the cache stays
 * fresh. While the initial IndexedDB read is pending, returns `undefined`.
 * After that, returns the cached array (possibly empty on first-ever load,
 * then populated once the server responds).
 *
 * Components using this hook re-render automatically when the underlying
 * table changes (e.g. after a sync or a local put/delete).
 */
export function useLocalCollection<T = any>(
  storeName: string,
  fetchFn?: () => Promise<any>,
): T[] | undefined {
  const data = useLiveQuery(
    () => db.table(storeName).toArray() as Promise<T[]>,
    [storeName],
  )

  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn
  const storeRef = useRef(storeName)
  storeRef.current = storeName

  useEffect(() => {
    if (fetchRef.current) {
      pullStore(storeRef.current, fetchRef.current)
    }
  }, [storeName])

  return data
}

/**
 * Returns a single item from a local IndexedDB table by primary key.
 * Triggers a background fetch for that item if `fetchFn` is provided.
 */
export function useLocalItem<T = any>(
  storeName: string,
  id: string | undefined | null,
  fetchFn?: (id: string) => Promise<any>,
): T | undefined {
  const data = useLiveQuery(
    () => (id ? db.table(storeName).get(id) as Promise<T | undefined> : undefined),
    [storeName, id],
  )

  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  useEffect(() => {
    if (id && fetchRef.current) {
      const fn = fetchRef.current
      fn(id)
        .then((item: any) => {
          if (item) db.table(storeName).put(item)
        })
        .catch(() => {})
    }
  }, [storeName, id])

  return data
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

export async function putLocal(storeName: string, item: any): Promise<void> {
  await db.table(storeName).put(item)
}

export async function putLocalBulk(storeName: string, items: any[]): Promise<void> {
  await db.table(storeName).bulkPut(items)
}

export async function deleteLocal(storeName: string, id: string): Promise<void> {
  await db.table(storeName).delete(id)
}

export async function refreshLocal(storeName: string, fetchFn: () => Promise<any>): Promise<void> {
  await pullStore(storeName, fetchFn)
}

// ---------------------------------------------------------------------------
// Optimistic writes — instant UI, background server sync
// ---------------------------------------------------------------------------

export type SyncInfo = { endpoint: string; body?: any }

/**
 * Optimistic CREATE: adds item to IndexedDB with a temp ID instantly,
 * then syncs to server in the background. On success the temp item is
 * replaced with the server's authoritative version. On network failure the
 * mutation is queued in the outbox for retry. On server validation error
 * the temp item is rolled back.
 */
export async function optimisticCreate(
  storeName: string,
  data: Record<string, any>,
  serverFn: () => Promise<any>,
  syncInfo?: SyncInfo,
): Promise<void> {
  const tempId = generateTempId()
  const localItem = { ...data, id: tempId }
  await db.table(storeName).add(localItem)

  serverFn()
    .then(async (result) => {
      await db.transaction('rw', db.table(storeName), async () => {
        await db.table(storeName).delete(tempId)
        if (result && typeof result === 'object' && result.id) {
          await db.table(storeName).put(result)
        }
      })
    })
    .catch(async (err) => {
      if (isNetworkError(err) && syncInfo) {
        await db.syncQueue.add({
          endpoint: syncInfo.endpoint,
          method: 'POST',
          body: JSON.stringify(syncInfo.body),
          storeName,
          tempId,
          createdAt: Date.now(),
          retries: 0,
        })
      } else {
        await db.table(storeName).delete(tempId).catch(() => {})
      }
    })
}

/**
 * Optimistic UPDATE: patches the item in IndexedDB instantly, then syncs
 * to server. Rolls back to the original on failure.
 */
export async function optimisticUpdate(
  storeName: string,
  id: string,
  changes: Record<string, any>,
  serverFn: () => Promise<any>,
  syncInfo?: SyncInfo,
): Promise<void> {
  const original = await db.table(storeName).get(id)
  await db.table(storeName).update(id, changes)

  serverFn()
    .then(async (result) => {
      if (result && typeof result === 'object' && result.id) {
        await db.table(storeName).put(result)
      }
    })
    .catch(async (err) => {
      if (isNetworkError(err) && syncInfo) {
        await db.syncQueue.add({
          endpoint: syncInfo.endpoint,
          method: 'PATCH',
          body: JSON.stringify(syncInfo.body),
          storeName,
          rollbackData: original ? JSON.stringify(original) : undefined,
          createdAt: Date.now(),
          retries: 0,
        })
      } else if (original) {
        await db.table(storeName).put(original).catch(() => {})
      }
    })
}

/**
 * Optimistic DELETE: removes the item from IndexedDB instantly, then syncs
 * to server. Restores the item on failure.
 */
export async function optimisticDelete(
  storeName: string,
  id: string,
  serverFn: () => Promise<any>,
  syncInfo?: SyncInfo,
): Promise<void> {
  const original = await db.table(storeName).get(id)
  await db.table(storeName).delete(id)

  serverFn()
    .catch(async (err) => {
      if (isNetworkError(err) && syncInfo) {
        await db.syncQueue.add({
          endpoint: syncInfo.endpoint,
          method: 'DELETE',
          storeName,
          rollbackData: original ? JSON.stringify(original) : undefined,
          createdAt: Date.now(),
          retries: 0,
        })
      } else if (original) {
        await db.table(storeName).put(original).catch(() => {})
      }
    })
}
