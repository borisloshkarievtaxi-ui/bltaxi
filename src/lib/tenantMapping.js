export const DEFAULT_ONBOARDING_PRIMARY = '#bca510'
export const DEFAULT_TENANT_COMMISSION = 15

/**
 * Live Supabase `tenants` columns (no separate whatsapp column — use phone_number).
 * Onboarding form `phone` → DB `phone_number`.
 */
export const TENANT_INSERT_COLUMNS = [
  'slug',
  'business_name',
  'phone_number',
  'logo_url',
  'primary_color',
  'default_commission',
]

export function normalizeTenantSlug(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function mapOnboardingFormToTenantRow(values) {
  return {
    slug: normalizeTenantSlug(values.slug),
    business_name: String(values.business_name ?? '').trim(),
    phone_number: String(values.phone ?? values.phone_number ?? '').trim(),
    logo_url: String(values.logo_url ?? '').trim() || null,
    primary_color: String(values.primary_color ?? '').trim() || DEFAULT_ONBOARDING_PRIMARY,
    default_commission: DEFAULT_TENANT_COMMISSION,
  }
}

export function mapTenantSettingsToRow(values) {
  return {
    business_name: String(values.business_name ?? '').trim(),
    phone_number: String(values.phone_number ?? values.phone ?? '').trim(),
    logo_url: String(values.logo_url ?? '').trim() || null,
    primary_color: String(values.primary_color ?? '').trim() || DEFAULT_ONBOARDING_PRIMARY,
    default_commission: Number(values.default_commission ?? DEFAULT_TENANT_COMMISSION),
  }
}

/** Strip client-only flags before Supabase insert/update payloads. */
export function pickTenantDbPayload(row) {
  const source = row ?? {}
  return {
    slug: source.slug,
    business_name: source.business_name,
    phone_number: source.phone_number ?? '',
    logo_url: source.logo_url ?? null,
    primary_color: source.primary_color ?? DEFAULT_ONBOARDING_PRIMARY,
    default_commission: Number(source.default_commission ?? DEFAULT_TENANT_COMMISSION),
  }
}
