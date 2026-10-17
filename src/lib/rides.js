import { computeCommissionValue } from './schema.js'
import { getErrorMessage, isNetworkError } from './supabase.js'

export function normalizeRideFormValues(values) {
  return {
    client_name: String(values.client_name ?? '').trim(),
    client_phone: String(values.client_phone ?? '').trim(),
    origin: String(values.origin ?? '').trim(),
    destination: String(values.destination ?? '').trim(),
    price: values.price === '' || values.price == null ? '' : String(values.price).trim(),
  }
}

export function buildRideInsertPayload(tenant, values) {
  const normalized = normalizeRideFormValues(values)
  const priceNumber = normalized.price === '' ? null : Number(normalized.price)
  const price = Number.isFinite(priceNumber) ? priceNumber : null

  return {
    tenant_id: tenant.id,
    client_name: normalized.client_name || null,
    client_phone: normalized.client_phone || null,
    origin: normalized.origin,
    destination: normalized.destination,
    price,
    commission_value: computeCommissionValue(price, tenant.default_commission),
    status: 'pending',
    payment_status: 'unpaid',
    driver_id: null,
    driver_name: null,
  }
}

export function createOptimisticRide(tenant, values, payload) {
  const normalized = normalizeRideFormValues(values)
  return {
    id: `temp-${crypto.randomUUID()}`,
    tenant_id: tenant.id,
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
