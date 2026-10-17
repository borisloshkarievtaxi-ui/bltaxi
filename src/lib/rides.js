import { auditWritePayload } from './supabaseAudit.js'
import { computeCommissionValue } from './schema.js'
import { TENANT_SLUG } from './supabase.js'
import { resolveWriteTenant } from './tenant.js'

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

  if (!writeTenant?.id) {
    throw new Error('Missing tenant_id — cannot build ride insert payload')
  }

  const defaultCommission = writeTenant.default_commission ?? tenant?.default_commission ?? 15

  const payload = {
    tenant_id: writeTenant.id,
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

  auditWritePayload('rides', payload, 'rides.buildInsertPayload', 'insert')

  return payload
}
