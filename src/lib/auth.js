import { TENANT_SLUG } from './supabase.js'

export const DEV_ADMIN_SESSION_KEY = 'bltaxi_dev_admin_session'

/** Session shape — extend when Supabase Auth is wired in */
export function createAdminSession({
  tenantSlug,
  tenantId = null,
  provider = 'dev_bypass',
  role = 'admin',
}) {
  return {
    provider,
    tenantSlug,
    tenantId,
    userId: null,
    role,
    signedInAt: new Date().toISOString(),
  }
}

export function createDevAdminSession(tenantSlug = TENANT_SLUG, tenantId = null) {
  return createAdminSession({ tenantSlug, tenantId, provider: 'dev_bypass' })
}

export function readAdminSession() {
  try {
    const raw = sessionStorage.getItem(DEV_ADMIN_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.tenantSlug) return null
    return parsed
  } catch {
    return null
  }
}

export function writeAdminSession(session) {
  sessionStorage.setItem(DEV_ADMIN_SESSION_KEY, JSON.stringify(session))
}

export function clearAdminSession() {
  sessionStorage.removeItem(DEV_ADMIN_SESSION_KEY)
}

export function isDevEnvironment() {
  return import.meta.env.DEV
}
