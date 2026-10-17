import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'
import { exportRidesCsv } from '../lib/csv.js'
import {
  computeDispatchMetrics,
  computeNetProfit,
  formatRideOrderId,
} from '../lib/dispatchMetrics.js'
import { formatDateTime, formatMoney, RIDE_STATUS_LABELS } from '../lib/format.js'
import { buildWhatsAppShareUrl } from '../lib/whatsapp.js'

const EMPTY_RIDE = {
  client_name: '',
  client_phone: '',
  origin: '',
  destination: '',
  price: '',
}

const FILTER_CHIPS = [
  { id: 'id', label: '# מזהה' },
  { id: 'driver', label: 'נהג' },
  { id: 'city', label: 'עיר' },
]

export default function RideDispatchLog() {
  const {
    tenant,
    rides,
    drivers,
    createRide,
    updateRide,
    deleteRide,
    assignDriver,
    updateRideStatus,
    refresh,
  } = useAppData()

  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState([])
  const [assignments, setAssignments] = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [editRide, setEditRide] = useState(null)
  const [form, setForm] = useState(EMPTY_RIDE)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const metrics = useMemo(() => computeDispatchMetrics(rides), [rides])

  const assignableDrivers = useMemo(
    () => drivers.filter((driver) => driver.status !== 'offline'),
    [drivers],
  )

  const filteredRides = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rides.filter((ride, index) => {
      const orderId = formatRideOrderId(ride, index).toLowerCase()
      const driverName = (ride.driver_name || '').toLowerCase()
      const city = `${ride.origin || ''} ${ride.destination || ''}`.toLowerCase()
      const haystack = [
        orderId,
        ride.client_name,
        ride.client_phone,
        ride.origin,
        ride.destination,
        driverName,
      ]
        .join(' ')
        .toLowerCase()

      if (query && !haystack.includes(query)) return false

      if (activeFilters.includes('id') && query && !orderId.includes(query)) return false
      if (activeFilters.includes('driver') && query && !driverName.includes(query)) return false
      if (activeFilters.includes('city') && query && !city.includes(query)) return false

      return true
    })
  }, [rides, search, activeFilters])

  function toggleFilter(id) {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  function openAddModal() {
    setForm(EMPTY_RIDE)
    setEditRide(null)
    setShowAddModal(true)
  }

  function openEditModal(ride) {
    setEditRide(ride)
    setForm({
      client_name: ride.client_name || '',
      client_phone: ride.client_phone || '',
      origin: ride.origin || '',
      destination: ride.destination || '',
      price: ride.price ?? '',
    })
    setShowAddModal(true)
  }

  async function handleSaveRide(event) {
    event.preventDefault()
    if (!form.origin.trim() || !form.destination.trim()) return

    setSaving(true)
    setFormError('')
    try {
      const result = editRide
        ? await updateRide(editRide.id, form)
        : await createRide(form)

      if (result.success) {
        setForm(EMPTY_RIDE)
        setShowAddModal(false)
        setEditRide(null)
      } else if (result.error) {
        setFormError(result.error)
        console.error('[BLTaxi DB] ride save failed:', result.error)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(rideId) {
    if (!window.confirm('למחוק את הנסיעה מהיומן?')) return
    await deleteRide(rideId)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-brand" onClick={openAddModal}>
            + הוספת נסיעה
          </button>
          <button
            type="button"
            className="btn btn-pill"
            onClick={() =>
              exportRidesCsv(filteredRides, (ride) => formatRideOrderId(ride, rides.indexOf(ride)))
            }
          >
            ייצוא CSV
          </button>
          <button type="button" className="btn btn-pill" onClick={() => refresh()}>
            שמור יומן
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="מחזור ברוטו – החודש" value={formatMoney(metrics.grossTurnover)} />
        <MetricCard title="עמלות נטו שנגבו – החודש" value={formatMoney(metrics.netCommissions)} />
        <MetricCard title="נסיעות שהושלמו – החודש" value={String(metrics.completedCount)} />
      </div>

      <div className="rounded-2xl border border-line bg-[#101012] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-zinc-300">עמלות פתוחות לגבייה</p>
        <p className="text-2xl font-extrabold gold-text">{formatMoney(metrics.openCommissions)}</p>
      </div>

      <div className="space-y-3">
        <input
          className="field"
          placeholder="לדוגמה: #2507, יוסי, תל אביב..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`chip ${activeFilters.includes(chip.id) ? 'chip-active' : ''}`}
              onClick={() => toggleFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-panel-2 text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">הזמנה</th>
                <th className="px-4 py-3 font-semibold">לקוח</th>
                <th className="px-4 py-3 font-semibold">מסלול</th>
                <th className="px-4 py-3 font-semibold">מועד</th>
                <th className="px-4 py-3 font-semibold">נהג / פנימי</th>
                <th className="px-4 py-3 font-semibold">מחיר</th>
                <th className="px-4 py-3 font-semibold">סטטוס</th>
                <th className="px-4 py-3 font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredRides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    אין נסיעות להצגה
                  </td>
                </tr>
              ) : (
                filteredRides.map((ride) => {
                  const rideIndex = rides.indexOf(ride)
                  const orderId = formatRideOrderId(ride, rideIndex)
                  const selectedDriver = assignments[ride.id] || ride.driver_id || ''
                  const assignedDriver =
                    ride.driver_name ||
                    drivers.find((driver) => driver.id === ride.driver_id)?.name ||
                    'טרם שובץ'
                  const netProfit = computeNetProfit(ride)

                  return (
                    <tr key={ride.id} className="border-t border-line align-top hover:bg-[#141417]">
                      <td className="px-4 py-4 font-extrabold gold-text whitespace-nowrap">{orderId}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold">{ride.client_name || 'ללא שם'}</div>
                        <div className="text-muted" dir="ltr">
                          {ride.client_phone || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>{ride.origin}</div>
                        <div className="text-muted">← {ride.destination}</div>
                      </td>
                      <td className="px-4 py-4 text-muted whitespace-nowrap">
                        {formatDateTime(ride.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold">{assignedDriver}</div>
                        {netProfit != null ? (
                          <span className="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold brand-text bg-[color-mix(in_srgb,var(--brand)_15%,transparent)]">
                            רווח נטו {formatMoney(netProfit)}
                          </span>
                        ) : null}
                        <select
                          className="field mt-2 min-w-40"
                          value={selectedDriver}
                          onChange={(event) =>
                            setAssignments((prev) => ({ ...prev, [ride.id]: event.target.value }))
                          }
                        >
                          <option value="">בחירת נהג</option>
                          {assignableDrivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-pill mt-2 w-full text-xs"
                          disabled={!selectedDriver}
                          onClick={() => assignDriver(ride.id, selectedDriver)}
                        >
                          שיוך נהג
                        </button>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-bold">
                        {formatMoney(ride.price)}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          className="field min-w-32 rounded-full text-xs font-bold"
                          value={ride.status}
                          onChange={(event) =>
                            updateRideStatus(ride.id, event.target.value, selectedDriver)
                          }
                        >
                          {['pending', 'assigned', 'completed'].map((status) => (
                            <option key={status} value={status}>
                              {RIDE_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-44 flex-col gap-2">
                          <button
                            type="button"
                            className="btn btn-pill text-xs"
                            onClick={() => openEditModal(ride)}
                          >
                            עריכה / פנימי
                          </button>
                          <a
                            href={buildWhatsAppShareUrl(ride, tenant)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-pill text-xs"
                          >
                            שתף לוואטסאפ 📲
                          </a>
                          <button
                            type="button"
                            className="btn btn-danger text-xs"
                            onClick={() => handleDelete(ride.id)}
                          >
                            מחק
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleSaveRide}
            className="w-full max-w-xl rounded-2xl border border-line bg-panel p-5 space-y-4"
          >
            <h3 className="text-xl font-extrabold gold-text">
              {editRide ? 'עריכת נסיעה' : 'הוספת נסיעה'}
            </h3>
            {formError ? (
              <p className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-100">
                {formError}
              </p>
            ) : null}
            <FormField label="שם לקוח">
              <input
                className="field"
                value={form.client_name}
                onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))}
              />
            </FormField>
            <FormField label="טלפון">
              <input
                className="field"
                dir="ltr"
                value={form.client_phone}
                onChange={(e) => setForm((p) => ({ ...p, client_phone: e.target.value }))}
              />
            </FormField>
            <FormField label="מוצא">
              <input
                className="field"
                required
                value={form.origin}
                onChange={(e) => setForm((p) => ({ ...p, origin: e.target.value }))}
              />
            </FormField>
            <FormField label="יעד">
              <input
                className="field"
                required
                value={form.destination}
                onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))}
              />
            </FormField>
            <FormField label="מחיר">
              <input
                className="field"
                type="number"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-pill"
                onClick={() => {
                  setShowAddModal(false)
                  setEditRide(null)
                }}
              >
                ביטול
              </button>
              <button type="submit" className="btn btn-brand" disabled={saving}>
                {saving ? 'שומר...' : editRide ? 'עדכון' : 'הוסף ליומן'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}

function MetricCard({ title, value }) {
  return (
    <div className="metric-card">
      <p className="text-xs font-semibold text-muted">{title}</p>
      <p className="metric-value mt-2">{value}</p>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  )
}
