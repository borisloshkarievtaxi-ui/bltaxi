import { TENANT_SLUG } from './supabase.js'

/** In-memory fallback when Supabase returns no row or RLS blocks `tenants` reads */
export const FALLBACK_TENANT_BLTAXI_DEMO = {
  id: 'f15a8c2e-7eef-4621-b0ec-02f5958e8620',
  slug: TENANT_SLUG,
  business_name: 'BL Taxi',
  logo_url: null,
  primary_color: '#16a34a',
  phone_number: '',
  default_commission: 15,
  created_at: null,
}

export function getFallbackTenant(slug) {
  if (slug !== TENANT_SLUG) return null
  return { ...FALLBACK_TENANT_BLTAXI_DEMO }
}

/**
 * Prefer cloud tenant row; otherwise use known fallback for bltaxi-demo.
 */
export function resolveTenant(slug, remoteRow) {
  if (remoteRow) {
    return { tenant: remoteRow, source: 'cloud' }
  }

  const fallback = getFallbackTenant(slug)
  if (fallback) {
    return { tenant: fallback, source: 'fallback' }
  }

  return { tenant: null, source: null }
}
