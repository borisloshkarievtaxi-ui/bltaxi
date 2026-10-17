import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { DRIVER_COLUMNS, RIDE_COLUMNS, TENANT_COLUMNS } from '../lib/schema.js'
import {
  getErrorMessage,
  isNetworkError,
  isSupabaseConfigured,
  sleep,
  supabase,
  TENANT_SLUG,
} from '../lib/supabase.js'
import {
  buildRideInsertPayload,
  createOptimisticRide,
  isRetriableRideError,
} from '../lib/rides.js'
import { getFallbackTenant, resolveTenant } from '../lib/tenant.js'

const AppDataContext = createContext(null)
const LOAD_RETRIES = 3
const AUTO_RETRY_MS = 20_000

function upsertById(list, row) {
  const next = Array.isArray(list) ? [...list] : []
  const index = next.findIndex((item) => item.id === row.id)
  if (index === -1) return [row, ...next]
  next[index] = { ...next[index], ...row }
  return next
}

function removeById(list, id) {
  return (list ?? []).filter((item) => item.id !== id)
}

async function runWithRetry(task) {
  let lastError = null

  for (let attempt = 0; attempt < LOAD_RETRIES; attempt += 1) {
    const result = await task()
    if (!result.error) return result

    lastError = result.error
    const canRetry = isNetworkError(result.error) && attempt < LOAD_RETRIES - 1
    if (!canRetry) break
    await sleep(800 * (attempt + 1))
  }

  return { error: lastError }
}

export function AppDataProvider({ children }) {
  const location = useLocation()
  const { isAdminAuthenticated, adminTenantSlug, session: authSession } = useAuth()
  const configured = isSupabaseConfigured()

  const activeTenantSlug = useMemo(() => {
    if (location.pathname.startsWith('/book')) return TENANT_SLUG
    if (isAdminAuthenticated && adminTenantSlug) return adminTenantSlug
    return null
  }, [location.pathname, isAdminAuthenticated, adminTenantSlug])

  const [configState, setConfigState] = useState(configured ? 'ready' : 'missing')
  const [loading, setLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [tenantSource, setTenantSource] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [rides, setRides] = useState([])
  const [notice, setNotice] = useState(null)
  const loadInFlight = useRef(false)
  const rideSyncTimers = useRef(new Map())

  const showNotice = useCallback((type, message) => {
    setNotice({ type, message })
  }, [])

  useEffect(() => {
    if (!activeTenantSlug) {
      setTenant(null)
      setTenantSource(null)
      return
    }

    const immediate = resolveTenant(activeTenantSlug, null)
    if (immediate.tenant) {
      setTenant(immediate.tenant)
      setTenantSource(immediate.source)
    }
  }, [activeTenantSlug])

  async function fetchDriversAndRidesForTenant(tenantId) {
    const [driversResult, ridesResult] = await Promise.all([
      supabase
        .from('drivers')
        .select(DRIVER_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true }),
      supabase
        .from('rides')
        .select(RIDE_COLUMNS)
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'assigned', 'completed'])
        .order('created_at', { ascending: false }),
    ])

    const firstError = driversResult.error || ridesResult.error
    if (firstError) return { error: firstError }

    return {
      data: {
        drivers: driversResult.data ?? [],
        rides: ridesResult.data ?? [],
      },
    }
  }

  const loadCloudData = useCallback(async () => {
    if (!configured || !supabase) {
      setConfigState('missing')
      setConnectionError('')
      return
    }

    if (!activeTenantSlug) {
      setTenant(null)
      setDrivers([])
      setRides([])
      setConnectionError('')
      setConfigState('ready')
      setLoading(false)
      return
    }

    if (loadInFlight.current) return
    loadInFlight.current = true
    setLoading(true)

    const tenantResult = await runWithRetry(() =>
      supabase.from('tenants').select(TENANT_COLUMNS).eq('slug', activeTenantSlug).maybeSingle(),
    )

    const cloudTenantRow = tenantResult.error ? null : tenantResult.data
    const { tenant: resolvedTenant, source } = resolveTenant(activeTenantSlug, cloudTenantRow)

    if (!resolvedTenant) {
      setConnectionError(getErrorMessage(tenantResult.error || 'Tenant not found'))
      setConfigState('ready')
      setLoading(false)
      loadInFlight.current = false
      return
    }

    setTenant(resolvedTenant)
    setTenantSource(source)

    const dataResult = await runWithRetry(() => fetchDriversAndRidesForTenant(resolvedTenant.id))

    if (dataResult.error) {
      setDrivers([])
      setRides([])
      setConnectionError(getErrorMessage(dataResult.error))
      setConfigState('ready')
      setLoading(false)
      loadInFlight.current = false
      return
    }

    setDrivers(dataResult.data.drivers)
    setRides(dataResult.data.rides)

    if (cloudTenantRow) {
      setTenant(cloudTenantRow)
      setTenantSource('cloud')
    } else {
      setTenantSource('fallback')
    }
    setConnectionError('')

    setConfigState('ready')
    setLoading(false)
    loadInFlight.current = false
  }, [activeTenantSlug, configured])

  useEffect(() => {
    loadCloudData()
  }, [loadCloudData])

  useEffect(() => {
    if (!connectionError || !configured) return undefined

    const timer = setInterval(() => {
      loadCloudData()
    }, AUTO_RETRY_MS)

    return () => clearInterval(timer)
  }, [connectionError, configured, loadCloudData])

  useEffect(() => {
    if (configState !== 'ready' || !tenant?.id || !supabase) return undefined

    const channel = supabase
      .channel(`bltaxi-tenant-${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenants', filter: `id=eq.${tenant.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setTenant((prev) => getFallbackTenant(prev?.slug ?? TENANT_SLUG) || null)
            setTenantSource('fallback')
            return
          }
          if (payload.new) {
            setTenant((prev) => ({ ...prev, ...payload.new }))
            setTenantSource('cloud')
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers', filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setDrivers((prev) => removeById(prev, payload.old?.id))
            return
          }
          const row = payload.new
          if (!row) return
          setDrivers((prev) =>
            upsertById(prev, row).sort((a, b) => a.name.localeCompare(b.name, 'he')),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setRides((prev) => removeById(prev, payload.old?.id))
            return
          }
          const row = payload.new
          if (!row) return
          setRides((prev) =>
            upsertById(prev, row).sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at),
            ),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [configState, tenant?.id])

  const assignDriver = useCallback(
    async (rideId, driverId) => {
      if (!supabase) return { error: 'Supabase אינו מוגדר' }
      const driverRow = drivers.find((driver) => driver.id === driverId)

      const { data, error } = await supabase
        .from('rides')
        .update({
          driver_id: driverId,
          driver_name: driverRow?.name ?? null,
          status: 'assigned',
        })
        .eq('id', rideId)
        .select(RIDE_COLUMNS)
        .single()

      if (error) {
        showNotice('error', error.message)
        return { error: error.message }
      }

      await supabase.from('drivers').update({ status: 'busy' }).eq('id', driverId)
      setRides((prev) => upsertById(prev, data))
      setDrivers((prev) =>
        prev.map((driver) => (driver.id === driverId ? { ...driver, status: 'busy' } : driver)),
      )
      setConnectionError('')
      showNotice('success', 'הנהג שובץ לנסיעה')
      return { data }
    },
    [drivers, showNotice],
  )

  const updateRideStatus = useCallback(
    async (rideId, status, driverId) => {
      if (!supabase) return { error: 'Supabase אינו מוגדר' }

      const payload = { status }
      if (status === 'pending') {
        payload.driver_id = null
        payload.driver_name = null
      }
      if (status === 'assigned' && driverId) {
        const driverRow = drivers.find((driver) => driver.id === driverId)
        payload.driver_id = driverId
        payload.driver_name = driverRow?.name ?? null
      }

      const { data, error } = await supabase
        .from('rides')
        .update(payload)
        .eq('id', rideId)
        .select(RIDE_COLUMNS)
        .single()

      if (error) {
        showNotice('error', error.message)
        return { error: error.message }
      }

      if (status === 'completed' && data.driver_id) {
        const { count } = await supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', data.driver_id)
          .eq('status', 'assigned')

        if (!count) {
          await supabase.from('drivers').update({ status: 'available' }).eq('id', data.driver_id)
          setDrivers((prev) =>
            prev.map((driver) =>
              driver.id === data.driver_id ? { ...driver, status: 'available' } : driver,
            ),
          )
        }
      }

      setRides((prev) => upsertById(prev, data))
      setConnectionError('')
      showNotice('success', 'סטטוס הנסיעה עודכן')
      return { data }
    },
    [drivers, showNotice],
  )

  const syncRideToCloud = useCallback(
    async (tempId, payload, attempt = 0) => {
      if (!supabase) return

      try {
        const { data, error } = await supabase.from('rides').insert(payload).select(RIDE_COLUMNS).single()

        if (!error && data) {
          setRides((prev) => {
            const withoutTemp = prev.filter((ride) => ride.id !== tempId)
            return [data, ...withoutTemp]
          })
          setConnectionError('')
          showNotice('success', 'הנסיעה נשמרה בענן')
          rideSyncTimers.current.delete(tempId)
          return
        }

        if (error && isRetriableRideError(error) && attempt < 4) {
          const delayMs = 1500 * (attempt + 1)
          const timerId = setTimeout(() => {
            syncRideToCloud(tempId, payload, attempt + 1)
          }, delayMs)
          rideSyncTimers.current.set(tempId, timerId)
          return
        }

        if (error) {
          showNotice('error', getErrorMessage(error))
        }
      } catch (error) {
        if (isRetriableRideError(error) && attempt < 4) {
          const delayMs = 1500 * (attempt + 1)
          const timerId = setTimeout(() => {
            syncRideToCloud(tempId, payload, attempt + 1)
          }, delayMs)
          rideSyncTimers.current.set(tempId, timerId)
          return
        }
        showNotice('error', getErrorMessage(error))
      }
    },
    [showNotice],
  )

  const createRide = useCallback(
    async (values) => {
      if (!tenant?.id) return { success: false, error: 'אין תחנה פעילה' }
      if (!values.origin?.trim() || !values.destination?.trim()) {
        return { success: false, error: 'חובה למלא מוצא ויעד' }
      }

      const payload = buildRideInsertPayload(tenant, values)

      const applyOptimistic = () => {
        const optimistic = createOptimisticRide(tenant, values, payload)
        setRides((prev) => [optimistic, ...prev])
        if (supabase) {
          syncRideToCloud(optimistic.id, payload, 0)
        }
        showNotice(
          'success',
          'הנסיעה נוספה ליומן. השמירה בענן תושלם ברקע (ייתכן עיכוב בגלל רשת או הרשאות).',
        )
        return { success: true, data: optimistic, pending: true }
      }

      if (!supabase) {
        return applyOptimistic()
      }

      try {
        const { data, error } = await supabase.from('rides').insert(payload).select(RIDE_COLUMNS).single()

        if (!error && data) {
          setRides((prev) => [data, ...prev])
          setConnectionError('')
          showNotice('success', 'נסיעה חדשה נפתחה ביומן')
          return { success: true, data }
        }

        if (error && isRetriableRideError(error)) {
          return applyOptimistic()
        }

        if (error) {
          showNotice('error', getErrorMessage(error))
          return { success: false, error: getErrorMessage(error) }
        }
      } catch (error) {
        if (isRetriableRideError(error)) {
          return applyOptimistic()
        }
        showNotice('error', getErrorMessage(error))
        return { success: false, error: getErrorMessage(error) }
      }

      return { success: false, error: 'לא ניתן לשמור את הנסיעה' }
    },
    [showNotice, syncRideToCloud, tenant],
  )

  const createDriver = useCallback(
    async (values) => {
      if (!supabase || !tenant) return { error: 'אין תחנה פעילה' }

      const { data, error } = await supabase
        .from('drivers')
        .insert({
          tenant_id: tenant.id,
          name: values.name,
          phone: values.phone,
          status: values.status || 'available',
          balance: values.balance === '' ? 0 : Number(values.balance),
        })
        .select(DRIVER_COLUMNS)
        .single()

      if (error) {
        showNotice('error', error.message)
        return { error: error.message }
      }

      setDrivers((prev) => upsertById(prev, data).sort((a, b) => a.name.localeCompare(b.name, 'he')))
      setConnectionError('')
      showNotice('success', 'הנהג נוסף לרשימה')
      return { data }
    },
    [showNotice, tenant],
  )

  const updateDriverStatus = useCallback(
    async (driverId, status) => {
      if (!supabase) return { error: 'Supabase אינו מוגדר' }
      const { data, error } = await supabase
        .from('drivers')
        .update({ status })
        .eq('id', driverId)
        .select(DRIVER_COLUMNS)
        .single()

      if (error) {
        showNotice('error', error.message)
        return { error: error.message }
      }

      setDrivers((prev) => upsertById(prev, data))
      setConnectionError('')
      return { data }
    },
    [showNotice],
  )

  const updateTenant = useCallback(
    async (values) => {
      if (!supabase || !tenant) return { error: 'אין תחנה פעילה' }

      const { data, error } = await supabase
        .from('tenants')
        .update({
          business_name: values.business_name,
          primary_color: values.primary_color,
          phone_number: values.phone_number,
          default_commission: Number(values.default_commission),
        })
        .eq('id', tenant.id)
        .select(TENANT_COLUMNS)
        .single()

      if (error) {
        showNotice('error', error.message)
        return { error: error.message }
      }

      setTenant(data)
      setConnectionError('')
      showNotice('success', 'הגדרות התחנה נשמרו בענן')
      return { data }
    },
    [showNotice, tenant],
  )

  const cloudConnected = configured && !connectionError && !loading

  const value = useMemo(
    () => ({
      configured,
      configState,
      connectionError,
      loading,
      cloudConnected,
      activeTenantSlug,
      authSession,
      tenantSource,
      tenant,
      drivers,
      rides,
      notice,
      showNotice,
      refresh: loadCloudData,
      assignDriver,
      updateRideStatus,
      createRide,
      createDriver,
      updateDriverStatus,
      updateTenant,
    }),
    [
      configured,
      configState,
      connectionError,
      loading,
      cloudConnected,
      activeTenantSlug,
      authSession,
      tenantSource,
      tenant,
      drivers,
      rides,
      notice,
      showNotice,
      loadCloudData,
      assignDriver,
      updateRideStatus,
      createRide,
      createDriver,
      updateDriverStatus,
      updateTenant,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider')
  }
  return context
}
