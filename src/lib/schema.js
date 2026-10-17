/**
 * Column lists aligned with the live Supabase schema.
 *
 * | Table    | Use in code              | NOT in DB (common mistakes)     |
 * |----------|--------------------------|----------------------------------|
 * | tenants  | business_name            | name                             |
 * | tenants  | phone_number             | phone, whatsapp                  |
 * | rides    | client_name, client_phone| customer_name, customer_phone    |
 * | rides    | tenant_id                | —                                |
 *
 * See `supabaseAudit.js` for runtime payload checks + console logging.
 */

export const TENANT_COLUMNS =
  'id, slug, business_name, logo_url, primary_color, phone_number, default_commission, created_at'

export const DRIVER_COLUMNS =
  'id, tenant_id, name, phone, status, balance, created_at'

export const RIDE_COLUMNS =
  'id, tenant_id, client_name, client_phone, origin, destination, price, driver_id, driver_name, commission_value, status, payment_status, created_at'

export function computeCommissionValue(price, commissionPercent) {
  const amount = Number(price)
  const percent = Number(commissionPercent)
  if (!Number.isFinite(amount) || !Number.isFinite(percent)) return null
  return Math.round(((amount * percent) / 100) * 100) / 100
}
