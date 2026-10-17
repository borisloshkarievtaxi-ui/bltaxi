/** Locally provisioned tenants (onboarding fallback when Supabase is unreachable). */
export const ACTIVE_TENANTS_STORAGE_KEY = 'bltaxi_active_tenants'

export function loadStoredTenants() {
  try {
    const raw = localStorage.getItem(ACTIVE_TENANTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((row) => row && typeof row === 'object' && row.slug && row.id)
  } catch {
    return []
  }
}

export function getStoredTenantBySlug(slug) {
  if (!slug) return null
  return loadStoredTenants().find((tenant) => tenant.slug === slug) ?? null
}

export function saveStoredTenant(tenant) {
  if (!tenant?.slug || !tenant?.id) return
  try {
    const others = loadStoredTenants().filter((row) => row.slug !== tenant.slug)
    localStorage.setItem(ACTIVE_TENANTS_STORAGE_KEY, JSON.stringify([tenant, ...others]))
  } catch {
    // Quota / private mode — session still carries slug/id.
  }
}

export function isLocalTenantRecord(tenant) {
  if (!tenant) return false
  return Boolean(tenant.localOnly || tenant.syncPending)
}
