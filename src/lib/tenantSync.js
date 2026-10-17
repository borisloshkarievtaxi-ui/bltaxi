import { TENANT_COLUMNS } from './schema.js'
import {
  getErrorMessage,
  isRecoverableOnboardingError,
  isSupabaseConfigured,
  supabase,
} from './supabase.js'
import { runLoggedSupabaseMutation } from './supabaseAudit.js'
import { pickTenantDbPayload } from './tenantMapping.js'
import { saveStoredTenant } from './tenantStorage.js'

function isDuplicateSlugError(error) {
  if (!error) return false
  const message = getErrorMessage(error).toLowerCase()
  return error.code === '23505' || message.includes('duplicate')
}

/**
 * Pushes a locally provisioned tenant to Supabase or links to an existing slug row.
 */
export async function syncStoredTenantToSupabase(tenant) {
  if (!tenant?.slug) return { data: tenant }
  if (!isSupabaseConfigured() || !supabase) return { data: tenant }
  if (!tenant.localOnly && !tenant.syncPending) return { data: tenant }

  const insertPayload = pickTenantDbPayload(tenant)

  try {
    const { data, error } = await runLoggedSupabaseMutation({
      context: 'tenantSync.insert',
      table: 'tenants',
      operation: 'insert',
      payload: insertPayload,
      run: () =>
        supabase.from('tenants').insert(insertPayload).select(TENANT_COLUMNS).single(),
    })

    if (!error && data) {
      const synced = { ...data, localOnly: false, syncPending: false }
      saveStoredTenant(synced)
      return { data: synced, synced: true }
    }

    if (error && isDuplicateSlugError(error)) {
      const { data: existing, error: readError } = await supabase
        .from('tenants')
        .select(TENANT_COLUMNS)
        .eq('slug', tenant.slug)
        .maybeSingle()

      if (!readError && existing) {
        const updatePayload = {
          business_name: tenant.business_name ?? existing.business_name,
          phone_number: tenant.phone_number ?? existing.phone_number,
          logo_url: tenant.logo_url ?? existing.logo_url,
          primary_color: tenant.primary_color ?? existing.primary_color,
          default_commission: tenant.default_commission ?? existing.default_commission,
        }

        const { data: updated, error: updateError } = await runLoggedSupabaseMutation({
          context: 'tenantSync.linkExistingSlug',
          table: 'tenants',
          operation: 'update',
          payload: updatePayload,
          run: () =>
            supabase
              .from('tenants')
              .update(updatePayload)
              .eq('id', existing.id)
              .select(TENANT_COLUMNS)
              .single(),
        })

        if (!updateError && updated) {
          const synced = { ...updated, localOnly: false, syncPending: false }
          saveStoredTenant(synced)
          return { data: synced, synced: true }
        }

        const linked = { ...existing, localOnly: false, syncPending: false }
        saveStoredTenant(linked)
        return { data: linked, synced: true }
      }
    }

    if (error && !isRecoverableOnboardingError(error)) {
      return { data: tenant, error: getErrorMessage(error) }
    }
  } catch (error) {
    if (!isRecoverableOnboardingError(error)) {
      return { data: tenant, error: getErrorMessage(error) }
    }
  }

  return { data: tenant }
}
