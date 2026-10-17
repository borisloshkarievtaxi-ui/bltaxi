import { TENANT_COLUMNS } from './schema.js'
import { getErrorMessage, supabase } from './supabase.js'

export const DEFAULT_ONBOARDING_PRIMARY = '#bca510'
export const DEFAULT_TENANT_COMMISSION = 15

export function normalizeTenantSlug(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function validateTenantSlug(slug) {
  if (!slug) return 'יש להזין מזהה כתובת (slug)'
  if (slug.length < 2) return 'מזהה הכתובת קצר מדי (לפחות 2 תווים)'
  if (slug.length > 48) return 'מזהה הכתובת ארוך מדי'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'מזהה הכתובת יכול להכיל אותיות באנגלית, ספרות ומקף בלבד'
  }
  return null
}

export function validateOnboardingForm(values) {
  const businessName = String(values.business_name ?? '').trim()
  if (!businessName) return 'יש למלא שם תחנה'

  const slug = normalizeTenantSlug(values.slug)
  const slugError = validateTenantSlug(slug)
  if (slugError) return slugError

  const phone = String(values.phone ?? '').trim()
  if (!phone) return 'יש למלא טלפון / WhatsApp'

  const color = String(values.primary_color ?? '').trim()
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return 'צבע מותג לא תקין (HEX, למשל #bca510)'
  }

  const logoUrl = String(values.logo_url ?? '').trim()
  if (logoUrl) {
    try {
      const parsed = new URL(logoUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'כתובת לוגו חייבת להתחיל ב-http או https'
      }
    } catch {
      return 'כתובת לוגו לא תקינה'
    }
  }

  return null
}

export function buildTenantInsertPayload(values) {
  const slug = normalizeTenantSlug(values.slug)
  return {
    slug,
    business_name: String(values.business_name).trim(),
    phone_number: String(values.phone).trim(),
    logo_url: String(values.logo_url ?? '').trim() || null,
    primary_color: String(values.primary_color ?? '').trim() || DEFAULT_ONBOARDING_PRIMARY,
    default_commission: DEFAULT_TENANT_COMMISSION,
  }
}

/**
 * Inserts a new tenant row in Supabase and returns the created record (including id).
 */
export async function createTenantOnline(values) {
  if (!supabase) {
    return { error: 'Supabase אינו מוגדר — הוסף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY' }
  }

  const validationError = validateOnboardingForm(values)
  if (validationError) return { error: validationError }

  const payload = buildTenantInsertPayload(values)

  const { data, error } = await supabase
    .from('tenants')
    .insert(payload)
    .select(TENANT_COLUMNS)
    .single()

  if (error) {
    const message = getErrorMessage(error)
    if (message.toLowerCase().includes('duplicate') || error.code === '23505') {
      return { error: 'מזהה הכתובת כבר תפוס — בחר slug אחר' }
    }
    return { error: message }
  }

  return { data, tenantId: data.id }
}
