import { TENANT_SLUG } from './supabase.js'

export const DEV_ADMIN_SESSION_KEY = 'bltaxi_dev_admin_session'

/** Session shape — extend when Supabase Auth is wired in */
export function createDevAdminSession(tenantSlug = TENANT_SLUG) {
  return {
    provider: 'dev_bypass',
    tenantSlug,
    userId: null,
    role: 'admin',
    signedInAt: new Date().toISOString(),
  }
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
