/** Cloud-only tenant resolution — no in-memory or localStorage fallbacks. */

export function resolveWriteTenant(tenant, slug) {
  if (!tenant?.id) return null
  return {
    ...tenant,
    id: tenant.id,
    slug: tenant.slug || slug,
  }
}

export function resolveTenant(_slug, remoteRow) {
  if (remoteRow) {
    return { tenant: remoteRow, source: 'cloud' }
  }
  return { tenant: null, source: null }
}
