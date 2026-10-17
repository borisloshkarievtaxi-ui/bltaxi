import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  computeCommissionValue,
  DRIVER_COLUMNS,
  RIDE_COLUMNS,
  TENANT_COLUMNS,
} from '../lib/schema.js'
import { isConfigError, isSupabaseConfigured, supabase, TENANT_SLUG } from '../lib/supabase.js'

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

function resolveCloudFailure(error, setConfigState, setConfigError, setLoading) {
  setConfigError(error.message)
  setConfigState(isConfigError(error) ? 'invalid' : 'cloud_error')
  setLoading(false)
}

export function AppDataProvider({ children }) {
  const configured = isSupabaseConfigured()
  const [configState, setConfigState] = useState(configured ? 'checking' : 'missing')
  const [configError, setConfigError] = useState('')
  const [loading, setLoading] = useState(configured)
  const [tenant, setTenant] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [rides, setRides] = useState([])
  const [notice, setNotice] = useState(null)

  const showNotice = useCallback((type, message) => {
    setNotice({ type, message })
  }, [])

  const loadCloudData = useCallback(async () => {
    if (!configured || !supabase) {
      setConfigState('missing')
      setLoading(false)
      return
    }

    setLoading(true)
    setConfigError('')

    const { data: tenantRow, error: tenantError } = await supabase
      .from('tenants')
      .select(TENANT_COLUMNS)
      .eq('slug', TENANT_SLUG)
      .maybeSingle()

    if (tenantError) {
      setTenant(null)
      setDrivers([])
      setRides([])
      resolveCloudFailure(tenantError, setConfigState, setConfigError, setLoading)
      return
    }

    if (!tenantRow) {
      setTenant(null)
      setDrivers([])
      setRides([])
      setConfigError('')
      setConfigState('ok')
      setLoading(false)
      return
    }

    const [driversResult, ridesResult] = await Promise.all([
      supabase
        .from('drivers')
        .select(DRIVER_COLUMNS)
        .eq('tenant_id', tenantRow.id)
        .order('name', { ascending: true }),
      supabase
        .from('rides')
        .select(RIDE_COLUMNS)
        .eq('tenant_id', tenantRow.id)
        .in('status', ['pending', 'assigned', 'completed'])
        .order('created_at', { ascending: false }),
    ])

    const firstError = driversResult.error || ridesResult.error
    if (firstError) {
      setTenant(null)
      setDrivers([])
      setRides([])
      resolveCloudFailure(firstError, setConfigState, setConfigError, setLoading)
      return
    }

    setTenant(tenantRow)
    setDrivers(driversResult.data ?? [])
    setRides(ridesResult.data ?? [])
    setConfigError('')
    setConfigState('ok')
    setLoading(false)
  }, [configured])

  useEffect(() => {
    loadCloudData()
  }, [loadCloudData])

  useEffect(() => {
    if (configState !== 'ok' || !tenant?.id || !supabase) return undefined

    const channel = supabase
      .channel(`bltaxi-tenant-${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenants', filter: `id=eq.${tenant.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setTenant(null)
            return
          }
          if (payload.new) setTenant((prev) => ({ ...prev, ...payload.new }))
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
      showNotice('success', 'סטטוס הנסיעה עודכן')
      return { data }
    },
    [drivers, showNotice],
  )

  const createRide = useCallback(
    async (values) => {
      if (!supabase || !tenant) return { error: 'אין תחנה פעילה' }

      const price = values.price === '' ? null : Number(values.price)
      const commission_value = computeCommissionValue(price, tenant.default_commission)

      const { data, error } = await supabase
        .from('rides')
        .insert({
          tenant_id: tenant.id,
          client_name: values.client_name,
          client_phone: values.client_phone,
          origin: values.origin,
          destination: values.destination,
          price,
          commission_value,
          status: 'pending',
          payment_status: 'unpaid',
        })
        .select(RIDE_COLUMNS)
        .single()

      if (error) {
        showNotice('error', error.message)
        return { error: error.message }
      }

      setRides((prev) => [data, ...prev])
      showNotice('success', 'נסיעה חדשה נפתחה ביומן')
      return { data }
    },
    [showNotice, tenant],
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
      showNotice('success', 'הגדרות התחנה נשמרו בענן')
      return { data }
    },
    [showNotice, tenant],
  )

  const value = useMemo(
    () => ({
      configured,
      configState,
      configError,
      loading,
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
      configError,
      loading,
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
