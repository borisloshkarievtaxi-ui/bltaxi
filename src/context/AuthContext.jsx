import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearAdminSession,
  createDevAdminSession,
  isDevEnvironment,
  readAdminSession,
  writeAdminSession,
} from '../lib/auth.js'
import { isSupabaseConfigured, TENANT_SLUG } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = readAdminSession()
    if (stored) {
      setSession(stored)
      setReady(true)
      return
    }

    if (isDevEnvironment() && isSupabaseConfigured()) {
      const devSession = createDevAdminSession(TENANT_SLUG)
      writeAdminSession(devSession)
      setSession(devSession)
    }

    setReady(true)
  }, [])

  const setAdminSession = useCallback((nextSession) => {
    writeAdminSession(nextSession)
    setSession(nextSession)
    return nextSession
  }, [])

  const loginDevAdmin = useCallback(
    (tenantSlug = TENANT_SLUG, tenantId = null) => {
      return setAdminSession(createDevAdminSession(tenantSlug, tenantId))
    },
    [setAdminSession],
  )

  const logoutAdmin = useCallback(() => {
    clearAdminSession()
    setSession(null)
  }, [])

  const isAdminAuthenticated = Boolean(session?.tenantSlug)
  const adminTenantSlug = session?.tenantSlug ?? null
  const adminTenantId = session?.tenantId ?? null

  const value = useMemo(
    () => ({
      ready,
      session,
      isAdminAuthenticated,
      adminTenantSlug,
      adminTenantId,
      loginDevAdmin,
      setAdminSession,
      logoutAdmin,
      isDevEnvironment: isDevEnvironment(),
    }),
    [
      ready,
      session,
      isAdminAuthenticated,
      adminTenantSlug,
      adminTenantId,
      loginDevAdmin,
      setAdminSession,
      logoutAdmin,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
