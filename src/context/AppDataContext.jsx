import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { computeCommissionValue, DRIVER_COLUMNS, RIDE_COLUMNS, TENANT_COLUMNS } from '../lib/schema.js'
import { getErrorMessage, isSupabaseConfigured, supabase, TENANT_SLUG } from '../lib/supabase.js'
import { buildRideInsertPayload } from '../lib/rides.js'
import { runLoggedSupabaseMutation } from '../lib/supabaseAudit.js'
import { mapTenantSettingsToRow } from '../lib/tenantMapping.js'

const AppDataContext = createContext(null)

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

function sortRidesNewestFirst(rides) {
  return [...(rides ?? [])].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  )
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

  const showNotice = useCallback((_type, message) => {
    if (message) console.error('[BLTaxi]', message)
  }, [])

  useEffect(() => {
    if (!activeTenantSlug) {
      setTenant(null)
      setTenantSource(null)
      setRides([])
      setDrivers([])
      return
    }
    setRides([])
    setDrivers([])
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
    if (!activeTenantSlug) {
      setTenant(null)
      setDrivers([])
      setRides([])
      setConnectionError('')
      setConfigState('ready')
      setLoading(false)
      return
    }

    if (!configured || !supabase) {
      setConfigState('missing')
      setConnectionError('Supabase env vars are missing or invalid')
      return
    }

    if (loadInFlight.current) return
    loadInFlight.current = true
    setLoading(true)
    setConnectionError('')

    const tenantResult = await supabase
      .from('tenants')
      .select(TENANT_COLUMNS)
      .eq('slug', activeTenantSlug)
      .maybeSingle()

    if (tenantResult.error) {
      const message = getErrorMessage(tenantResult.error)
      console.error('[BLTaxi DB] tenants SELECT failed:', tenantResult.error)
      setTenant(null)
      setDrivers([])
      setRides([])
      setConnectionError(message)
      setConfigState('ready')
      setLoading(false)
      loadInFlight.current = false
      return
    }

    if (!tenantResult.data) {
      const message = `Tenant not found for slug: ${activeTenantSlug}`
      console.error('[BLTaxi DB]', message)
      setTenant(null)
      setDrivers([])
      setRides([])
      setConnectionError(message)
      setConfigState('ready')
      setLoading(false)
      loadInFlight.current = false
      return
    }

    const cloudTenantRow = tenantResult.data
    setTenant(cloudTenantRow)
    setTenantSource('cloud')

    const dataResult = await fetchDriversAndRidesForTenant(cloudTenantRow.id)

    if (dataResult.error) {
      const message = getErrorMessage(dataResult.error)
      console.error('[BLTaxi DB] drivers/rides SELECT failed:', dataResult.error)
      setDrivers([])
      setRides([])
      setConnectionError(message)
      setConfigState('ready')
      setLoading(false)
      loadInFlight.current = false
      return
    }

    setDrivers(dataResult.data.drivers)
    setRides(sortRidesNewestFirst(dataResult.data.rides))
    setConnectionError('')
    setConfigState('ready')
    setLoading(false)
    loadInFlight.current = false
  }, [activeTenantSlug, configured])

  useEffect(() => {
    loadCloudData()
  }, [loadCloudData])

  useEffect(() => {
    if (configState !== 'ready' || !tenant?.id || !supabase) return undefined

    const channel = supabase
      .channel(`bltaxi-tenant-${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenants', filter: `id=eq.${tenant.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setTenant(null)
            setConnectionError('Tenant row was deleted in Supabase')
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
          setRides((prev) => sortRidesNewestFirst(upsertById(prev, row)))
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
        console.error('[BLTaxi DB] rides UPDATE assign failed:', error)
        showNotice('error', error.message)
        return { error: error.message }
      }

      const driverUpdate = await supabase.from('drivers').update({ status: 'busy' }).eq('id', driverId)
      if (driverUpdate.error) {
        console.error('[BLTaxi DB] drivers UPDATE busy failed:', driverUpdate.error)
      }

      setRides((prev) => upsertById(prev, data))
      setDrivers((prev) =>
        prev.map((driver) => (driver.id === driverId ? { ...driver, status: 'busy' } : driver)),
      )
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
        console.error('[BLTaxi DB] rides UPDATE status failed:', error)
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
          const driverUpdate = await supabase
            .from('drivers')
            .update({ status: 'available' })
            .eq('id', data.driver_id)
          if (driverUpdate.error) {
            console.error('[BLTaxi DB] drivers UPDATE available failed:', driverUpdate.error)
          }
          setDrivers((prev) =>
            prev.map((driver) =>
              driver.id === data.driver_id ? { ...driver, status: 'available' } : driver,
            ),
          )
        }
      }

      setRides((prev) => upsertById(prev, data))
      return { data }
    },
    [drivers, showNotice],
  )

  const createRide = useCallback(
    async (values) => {
      if (!supabase) {
        return { success: false, error: 'Supabase אינו מוגדר' }
      }
      if (!tenant?.id) return { success: false, error: 'אין תחנה פעילה' }
      if (!values.origin?.trim() || !values.destination?.trim()) {
        return { success: false, error: 'חובה למלא מוצא ויעד' }
      }

      const tenantSlug = activeTenantSlug || TENANT_SLUG
      let payload
      try {
        payload = buildRideInsertPayload(tenant, values, tenantSlug)
      } catch (error) {
        return { success: false, error: getErrorMessage(error) }
      }

      const { data, error, auditFailed } = await runLoggedSupabaseMutation({
        context: 'rides.createRide',
        table: 'rides',
        operation: 'insert',
        payload,
        run: () => supabase.from('rides').insert(payload).select(RIDE_COLUMNS).single(),
      })

      if (auditFailed) {
        return { success: false, error: 'Schema audit failed — ride payload invalid' }
      }

      if (error) {
        console.error('[BLTaxi DB] rides INSERT failed:', error)
        return { success: false, error: getErrorMessage(error) }
      }

      if (!data) {
        return { success: false, error: 'Supabase insert succeeded but returned no ride row' }
      }

      setRides((prev) => sortRidesNewestFirst([data, ...prev]))
      return { success: true, data }
    },
    [activeTenantSlug, tenant],
  )

  const updateRide = useCallback(
    async (rideId, values) => {
      if (!tenant) return { success: false, error: 'אין תחנה פעילה' }
      if (!supabase) return { success: false, error: 'Supabase אינו מוגדר' }

      const price = values.price === '' ? null : Number(values.price)
      const payload = {
        client_name: values.client_name?.trim() || null,
        client_phone: values.client_phone?.trim() || null,
        origin: values.origin?.trim(),
        destination: values.destination?.trim(),
        price: Number.isFinite(price) ? price : null,
        commission_value: computeCommissionValue(price, tenant.default_commission),
      }

      const { data, error } = await supabase
        .from('rides')
        .update(payload)
        .eq('id', rideId)
        .select(RIDE_COLUMNS)
        .single()

      if (error) {
        console.error('[BLTaxi DB] rides UPDATE failed:', error)
        return { success: false, error: error.message }
      }

      setRides((prev) => upsertById(prev, data))
      return { success: true, data }
    },
    [tenant],
  )

  const deleteRide = useCallback(
    async (rideId) => {
      if (!supabase) return { success: false, error: 'Supabase אינו מוגדר' }

      const { error } = await supabase.from('rides').delete().eq('id', rideId)
      if (error) {
        console.error('[BLTaxi DB] rides DELETE failed:', error)
        return { success: false, error: error.message }
      }

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
        console.error('[BLTaxi DB] drivers INSERT failed:', error)
        showNotice('error', error.message)
        return { error: error.message }
      }

      setDrivers((prev) => upsertById(prev, data).sort((a, b) => a.name.localeCompare(b.name, 'he')))
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
        console.error('[BLTaxi DB] drivers UPDATE status failed:', error)
        showNotice('error', error.message)
        return { error: error.message }
      }

      setDrivers((prev) => upsertById(prev, data))
      return { data }
    },
    [showNotice],
  )

  const updateTenant = useCallback(
    async (values) => {
      if (!tenant) return { error: 'אין תחנה פעילה' }
      if (!supabase) return { error: 'Supabase אינו מוגדר' }

      const payload = mapTenantSettingsToRow(values)

      const { data, error } = await runLoggedSupabaseMutation({
        context: 'tenants.updateTenant',
        table: 'tenants',
        operation: 'update',
        payload,
        run: () =>
          supabase
            .from('tenants')
            .update(payload)
            .eq('id', tenant.id)
            .select(TENANT_COLUMNS)
            .single(),
      })

      if (error) {
        console.error('[BLTaxi DB] tenants UPDATE failed:', error)
        return { error: error.message }
      }

      setTenant(data)
      return { data }
    },
    [tenant],
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
