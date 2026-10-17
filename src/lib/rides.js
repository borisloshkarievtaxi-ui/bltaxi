import { computeCommissionValue } from './schema.js'
import { getErrorMessage, isNetworkError, TENANT_SLUG } from './supabase.js'
import { FALLBACK_TENANT_BLTAXI_DEMO, resolveWriteTenant } from './tenant.js'

export function normalizeRideFormValues(values) {
  return {
    client_name: String(values.client_name ?? '').trim(),
    client_phone: String(values.client_phone ?? '').trim(),
    origin: String(values.origin ?? '').trim(),
    destination: String(values.destination ?? '').trim(),
    price: values.price === '' || values.price == null ? '' : String(values.price).trim(),
  }
}

export function buildRideInsertPayload(tenant, values, tenantSlug = TENANT_SLUG) {
  const normalized = normalizeRideFormValues(values)
  const priceNumber = normalized.price === '' ? null : Number(normalized.price)
  const price = Number.isFinite(priceNumber) ? priceNumber : null
  const writeTenant = resolveWriteTenant(tenant, tenantSlug)
  const tenantId = writeTenant?.id || FALLBACK_TENANT_BLTAXI_DEMO.id
  const defaultCommission =
    writeTenant?.default_commission ?? tenant?.default_commission ?? FALLBACK_TENANT_BLTAXI_DEMO.default_commission

  return {
    tenant_id: tenantId,
    client_name: normalized.client_name || null,
    client_phone: normalized.client_phone || null,
    origin: normalized.origin,
    destination: normalized.destination,
    price,
    commission_value: computeCommissionValue(price, defaultCommission),
    status: 'pending',
    payment_status: 'unpaid',
    driver_id: null,
    driver_name: null,
  }
}

export function createOptimisticRide(tenant, values, payload, tenantSlug = TENANT_SLUG) {
  const normalized = normalizeRideFormValues(values)
  const writeTenant = resolveWriteTenant(tenant, tenantSlug)
  const tenantId = payload.tenant_id || writeTenant?.id || FALLBACK_TENANT_BLTAXI_DEMO.id

  return {
    id: `temp-${crypto.randomUUID()}`,
    tenant_id: tenantId,
    client_name: normalized.client_name || null,
    client_phone: normalized.client_phone || null,
    origin: normalized.origin,
    destination: normalized.destination,
    price: payload.price,
    driver_id: null,
    driver_name: null,
    commission_value: payload.commission_value,
    status: 'pending',
    payment_status: 'unpaid',
    created_at: new Date().toISOString(),
    syncPending: true,
    localOnly: true,
  }
}

export function isRetriableRideError(error) {
  if (!error) return false
  if (isNetworkError(error)) return true

  const message = getErrorMessage(error).toLowerCase()
  const status = error.status ?? error.statusCode ?? error.code

  return (
    status === 401 ||
    status === 403 ||
    status === 425 ||
    message.includes('failed to fetch') ||
    message.includes('row-level security') ||
    message.includes('rls') ||
    message.includes('permission denied') ||
    message.includes('jwt')
  )
}
