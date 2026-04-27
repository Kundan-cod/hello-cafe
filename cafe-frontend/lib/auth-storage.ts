/**
 * Auth storage backed by localStorage.
 */

export type AuthData = {
  token: string
  tenantId: string
  user: string
  role?: string
  branchId?: string | null
  mustChangePassword?: boolean
}

export function saveAuth(
  token: string,
  tenantId: string,
  user: string,
  options?: { role?: string; branchId?: string | null; mustChangePassword?: boolean }
): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('token', token)
  localStorage.setItem('tenantId', tenantId)
  localStorage.setItem('user', user)
  if (options?.role != null) localStorage.setItem('role', options.role)
  if (options?.branchId != null) localStorage.setItem('branchId', options.branchId)
  else if (options?.branchId === null) localStorage.removeItem('branchId')
  if (options?.mustChangePassword != null) localStorage.setItem('mustChangePassword', String(options.mustChangePassword))
}

/** Read auth from localStorage synchronously. Returns null if not logged in. */
export function getAuthSync(): AuthData | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem('token')
  const tenantId = localStorage.getItem('tenantId')
  const user = localStorage.getItem('user')
  if (!token || !tenantId || !user) return null
  return {
    token,
    tenantId,
    user,
    role: localStorage.getItem('role') ?? undefined,
    branchId: localStorage.getItem('branchId') ?? null,
    mustChangePassword: localStorage.getItem('mustChangePassword') === 'true',
  }
}

/** Read auth from localStorage (alias for getAuthSync for backward compatibility). */
export function getAuth(): Promise<AuthData | null> {
  return Promise.resolve(getAuthSync())
}

/**
 * Clear auth on logout so the next user does not see the previous user's data.
 * Also wipes the IndexedDB local cache.
 */
export async function clearAuth(): Promise<void> {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('tenantId')
  localStorage.removeItem('user')
  localStorage.removeItem('role')
  localStorage.removeItem('branchId')
  localStorage.removeItem('mustChangePassword')
  try {
    const { clearAllLocalData } = await import('./sync-engine')
    await clearAllLocalData()
  } catch {}
}

/** Backward-compatible no-op. */
export function restoreAuth(): Promise<boolean> {
  return Promise.resolve(false)
}
