import { TENANT_COLUMNS } from './schema.js'
import { getErrorMessage, isSupabaseConfigured, supabase } from './supabase.js'
import { auditWritePayload, runLoggedSupabaseMutation } from './supabaseAudit.js'
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

function isDuplicateSlugError(error) {
  if (!error) return false
  const message = getErrorMessage(error).toLowerCase()
  return error.code === '23505' || message.includes('duplicate')
}

/** Inserts tenant in Supabase only — fails loudly on any error. */
export async function provisionTenantFromOnboarding(values) {
  const validationError = validateOnboardingForm(values)
  if (validationError) return { error: validationError }

  if (!isSupabaseConfigured() || !supabase) {
    return {
      error:
        'Supabase לא מוגדר — הגדר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY בקובץ .env',
    }
  }

  const payload = buildTenantInsertPayload(values)
  auditWritePayload('tenants', payload, 'onboarding.buildPayload', 'insert')

  try {
    const { data, error, auditFailed } = await runLoggedSupabaseMutation({
      context: 'onboarding.provisionTenant',
      table: 'tenants',
      operation: 'insert',
      payload,
      run: () => supabase.from('tenants').insert(payload).select(TENANT_COLUMNS).single(),
    })

    if (auditFailed) {
      return { error: 'Schema audit failed — payload does not match tenants table' }
    }

    if (error) {
      if (isDuplicateSlugError(error)) {
        return { error: 'מזהה הכתובת כבר תפוס — בחר slug אחר' }
      }
      return { error: getErrorMessage(error) }
    }

    if (!data) {
      return { error: 'Supabase insert succeeded but returned no tenant row' }
    }

    return { data, tenantId: data.id, source: 'cloud' }
  } catch (error) {
    console.error('[BLTaxi DB] onboarding.provisionTenant: exception', error)
    return { error: getErrorMessage(error) }
  }
}

export async function createTenantOnline(values) {
  return provisionTenantFromOnboarding(values)
}
