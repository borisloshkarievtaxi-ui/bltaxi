import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { computeCommissionValue, DRIVER_COLUMNS, RIDE_COLUMNS, TENANT_COLUMNS } from '../lib/schema.js'
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
import {
  loadStoredRides,
  mergeStoredAndCloudRides,
  saveStoredRides,
  sortRidesNewestFirst,
} from '../lib/rideStorage.js'
import { getFallbackTenant, resolveTenant } from '../lib/tenant.js'
import { getStoredTenantBySlug, isLocalTenantRecord } from '../lib/tenantStorage.js'

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

  const showNotice = useCallback(() => {
    // Dispatch UI stays quiet; background sync does not surface banners.
  }, [])

  useEffect(() => {
    if (!activeTenantSlug) {
      setTenant(null)
      setTenantSource(null)
      setRides([])
      return
    }

    const immediate = resolveTenant(activeTenantSlug, null)
    if (immediate.tenant) {
      setTenant(immediate.tenant)
      setTenantSource(immediate.source)
    }

    setRides(sortRidesNewestFirst(loadStoredRides(activeTenantSlug)))
  }, [activeTenantSlug])

  useEffect(() => {
    if (!activeTenantSlug) return
    saveStoredRides(activeTenantSlug, rides)
  }, [activeTenantSlug, rides])

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
    if (!activeTenantSlug) {
      setTenant(null)
      setDrivers([])
      setConnectionError('')
      setConfigState('ready')
      setLoading(false)
      return
    }

    const storedTenant = getStoredTenantBySlug(activeTenantSlug)

    if (!configured || !supabase) {
      if (storedTenant) {
        setTenant(storedTenant)
        setTenantSource('local')
        setDrivers([])
        setRides(mergeStoredAndCloudRides(loadStoredRides(activeTenantSlug), []))
        setConnectionError('')
        setConfigState('ready')
        setLoading(false)
        return
      }
      setConfigState('missing')
      setConnectionError('')
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
      setRides(mergeStoredAndCloudRides(loadStoredRides(activeTenantSlug), []))
      setConnectionError(getErrorMessage(tenantResult.error || 'Tenant not found'))
      setConfigState('ready')
      setLoading(false)
      loadInFlight.current = false
      return
    }

    setTenant(resolvedTenant)
    setTenantSource(source)

    const quietLocalLoad =
      source === 'local' || isLocalTenantRecord(resolvedTenant) || isLocalTenantRecord(storedTenant)
    if (quietLocalLoad) {
      setConnectionError('')
    }

    const dataResult = await runWithRetry(() => fetchDriversAndRidesForTenant(resolvedTenant.id))

    if (dataResult.error) {
      setDrivers([])
      setRides(mergeStoredAndCloudRides(loadStoredRides(activeTenantSlug), []))
      if (quietLocalLoad) {
        setConnectionError('')
      } else {
        setConnectionError(getErrorMessage(dataResult.error))
      }
      setConfigState('ready')
      setLoading(false)
      loadInFlight.current = false
      return
    }

    setDrivers(dataResult.data.drivers)
    setRides(
      mergeStoredAndCloudRides(loadStoredRides(activeTenantSlug), dataResult.data.rides),
    )

    if (cloudTenantRow) {
      setTenant(cloudTenantRow)
      setTenantSource('cloud')
      setConnectionError('')
    } else if (source === 'local') {
      setConnectionError('')
    } else {
      setTenantSource('fallback')
      setConnectionError('')
    }

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
            const deletedId = payload.old?.id
            setRides((prev) => {
              const existing = prev.find((ride) => ride.id === deletedId)
              const keepLocal =
                existing?.localOnly ||
                existing?.syncPending ||
                String(deletedId).startsWith('temp-') ||
                String(deletedId).startsWith('local-')
              if (keepLocal) return prev
              return removeById(prev, deletedId)
            })
            return
          }
          const row = payload.new
          if (!row) return
          setRides((prev) =>
            sortRidesNewestFirst(
              upsertById(prev, { ...row, localOnly: false, syncPending: false }),
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
      const driverRow = drivers.find((driver) => driver.id === driverId)

      if (String(rideId).startsWith('temp-') || String(rideId).startsWith('local-')) {
        setRides((prev) => {
          const current = prev.find((ride) => ride.id === rideId)
          if (!current) return prev
          return sortRidesNewestFirst(
            upsertById(prev, {
              ...current,
              driver_id: driverId,
              driver_name: driverRow?.name ?? null,
              status: 'assigned',
            }),
          )
        })
        return { data: { id: rideId } }
      }

      if (!supabase) return { error: 'Supabase אינו מוגדר' }

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

      if (String(rideId).startsWith('temp-') || String(rideId).startsWith('local-')) {
        setRides((prev) =>
          sortRidesNewestFirst(
            upsertById(
              prev,
              prev
                .filter((ride) => ride.id === rideId)
                .map((ride) => ({ ...ride, ...payload }))[0] ?? { id: rideId, ...payload },
            ),
          ),
        )
        return { data: { id: rideId, ...payload } }
      }

      if (!supabase) return { error: 'Supabase אינו מוגדר' }

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
            return sortRidesNewestFirst([
              { ...data, localOnly: false, syncPending: false },
              ...withoutTemp,
            ])
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
          setRides((prev) =>
            sortRidesNewestFirst(
              upsertById(prev, {
                ...(prev.find((ride) => ride.id === tempId) ?? { id: tempId, ...payload }),
                id: tempId,
                localOnly: true,
                syncPending: false,
              }),
            ),
          )
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
        setRides((prev) =>
          sortRidesNewestFirst(
            upsertById(prev, {
              ...(prev.find((ride) => ride.id === tempId) ?? { id: tempId, ...payload }),
              id: tempId,
              localOnly: true,
              syncPending: false,
            }),
          ),
        )
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

      const tenantSlug = activeTenantSlug || TENANT_SLUG
      const payload = buildRideInsertPayload(tenant, values, tenantSlug)

      const applyOptimistic = () => {
        const optimistic = createOptimisticRide(tenant, values, payload, tenantSlug)
        setRides((prev) => sortRidesNewestFirst([optimistic, ...prev]))
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
          setRides((prev) =>
            sortRidesNewestFirst([{ ...data, localOnly: false, syncPending: false }, ...prev]),
          )
          setConnectionError('')
          showNotice('success', 'נסיעה חדשה נפתחה ביומן')
          return { success: true, data }
        }

        if (error) {
          return applyOptimistic()
        }
      } catch {
        return applyOptimistic()
      }

      return applyOptimistic()
    },
    [activeTenantSlug, showNotice, syncRideToCloud, tenant],
  )

  const updateRide = useCallback(
    async (rideId, values) => {
      if (!tenant) return { success: false, error: 'אין תחנה פעילה' }

      const price = values.price === '' ? null : Number(values.price)
      const payload = {
        client_name: values.client_name?.trim() || null,
        client_phone: values.client_phone?.trim() || null,
        origin: values.origin?.trim(),
        destination: values.destination?.trim(),
        price: Number.isFinite(price) ? price : null,
        commission_value: computeCommissionValue(price, tenant.default_commission),
      }

      if (String(rideId).startsWith('temp-') || String(rideId).startsWith('local-')) {
        setRides((prev) => {
          const current = prev.find((ride) => ride.id === rideId)
          if (!current) return prev
          return sortRidesNewestFirst(upsertById(prev, { ...current, ...payload }))
        })
        return { success: true, data: { id: rideId, ...payload } }
      }

      if (!supabase) return { success: false, error: 'Supabase אינו מוגדר' }

      const { data, error } = await supabase
        .from('rides')
        .update(payload)
        .eq('id', rideId)
        .select(RIDE_COLUMNS)
        .single()

      if (error) return { success: false, error: error.message }

      setRides((prev) => upsertById(prev, data))
      return { success: true, data }
    },
    [tenant],
  )

  const deleteRide = useCallback(
    async (rideId) => {
      if (String(rideId).startsWith('temp-') || String(rideId).startsWith('local-')) {
        setRides((prev) => prev.filter((ride) => ride.id !== rideId))
        return { success: true }
      }

      if (!supabase) {
        setRides((prev) => prev.filter((ride) => ride.id !== rideId))
        return { success: true }
      }

      const { error } = await supabase.from('rides').delete().eq('id', rideId)
      if (error) return { success: false, error: error.message }

      setRides((prev) => prev.filter((ride) => ride.id !== rideId))
      return { success: true }
    },
    [],
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
      updateRide,
      deleteRide,
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
      updateRide,
      deleteRide,
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
