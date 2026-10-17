import { TENANT_COLUMNS } from './schema.js'
import {
  getErrorMessage,
  isRecoverableOnboardingError,
  isSupabaseConfigured,
  supabase,
} from './supabase.js'
import { getStoredTenantBySlug, saveStoredTenant } from './tenantStorage.js'
import {
  DEFAULT_ONBOARDING_PRIMARY,
  mapOnboardingFormToTenantRow,
  normalizeTenantSlug,
} from './tenantMapping.js'

export {
  DEFAULT_ONBOARDING_PRIMARY,
  DEFAULT_TENANT_COMMISSION,
  normalizeTenantSlug,
} from './tenantMapping.js'

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
  return mapOnboardingFormToTenantRow(values)
}

export function createLocalTenantRecord(values, existingId = null) {
  const payload = buildTenantInsertPayload(values)
  return {
    id: existingId || crypto.randomUUID(),
    ...payload,
    created_at: new Date().toISOString(),
    localOnly: true,
    syncPending: true,
  }
}

function saveLocalTenantFallback(values, existingId = null) {
  const tenant = createLocalTenantRecord(values, existingId)
  saveStoredTenant(tenant)
  return { data: tenant, tenantId: tenant.id, source: 'local' }
}

function isDuplicateSlugError(error) {
  if (!error) return false
  const message = getErrorMessage(error).toLowerCase()
  return error.code === '23505' || message.includes('duplicate')
}

/**
 * Tries Supabase insert; on network/RLS failure saves tenant locally and still succeeds.
 */
export async function provisionTenantFromOnboarding(values) {
  const validationError = validateOnboardingForm(values)
  if (validationError) return { error: validationError }

  const payload = buildTenantInsertPayload(values)
  const existingLocal = getStoredTenantBySlug(payload.slug)

  if (!isSupabaseConfigured() || !supabase) {
    return saveLocalTenantFallback(values, existingLocal?.id ?? null)
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .insert(payload)
      .select(TENANT_COLUMNS)
      .single()

    if (!error && data) {
      const tenant = { ...data, localOnly: false, syncPending: false }
      saveStoredTenant(tenant)
      return { data: tenant, tenantId: tenant.id, source: 'cloud' }
    }

    if (error) {
      if (isDuplicateSlugError(error)) {
        return { error: 'מזהה הכתובת כבר תפוס — בחר slug אחר' }
      }
      if (isRecoverableOnboardingError(error)) {
        return saveLocalTenantFallback(values, existingLocal?.id ?? null)
      }
      return { error: getErrorMessage(error) }
    }
  } catch (error) {
    if (isRecoverableOnboardingError(error)) {
      return saveLocalTenantFallback(values, existingLocal?.id ?? null)
    }
    return { error: getErrorMessage(error) }
  }

  return saveLocalTenantFallback(values, existingLocal?.id ?? null)
}

/** @deprecated Use provisionTenantFromOnboarding */
export async function createTenantOnline(values) {
  return provisionTenantFromOnboarding(values)
}
