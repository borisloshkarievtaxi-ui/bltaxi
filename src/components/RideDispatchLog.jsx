import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'
import { formatDateTime, formatMoney, RIDE_STATUS_LABELS } from '../lib/format.js'
import { buildWhatsAppShareUrl } from '../lib/whatsapp.js'

const EMPTY_RIDE = {
  client_name: '',
  client_phone: '',
  origin: '',
  destination: '',
  price: '',
}

export default function RideDispatchLog() {
  const { rides, drivers, createRide, assignDriver, updateRideStatus } = useAppData()
  const [form, setForm] = useState(EMPTY_RIDE)
  const [saving, setSaving] = useState(false)
  const [assignments, setAssignments] = useState({})

  const assignableDrivers = useMemo(
    () => drivers.filter((driver) => driver.status !== 'offline'),
    [drivers],
  )

  async function handleCreate(event) {
    event.preventDefault()
    if (!form.origin.trim() || !form.destination.trim()) return
    setSaving(true)
    const result = await createRide(form)
    setSaving(false)
    if (!result.error) setForm(EMPTY_RIDE)
  }

  return (
    <section className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-3xl border border-line bg-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">פתיחת נסיעה</h2>
            <p className="text-sm text-muted">הנסיעה נשמרת ישירות ביומן הענן</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            label="שם הלקוח"
            value={form.client_name}
            onChange={(value) => setForm((prev) => ({ ...prev, client_name: value }))}
          />
          <Input
            label="טלפון"
            value={form.client_phone}
            onChange={(value) => setForm((prev) => ({ ...prev, client_phone: value }))}
          />
          <Input
            label="מוצא"
            required
            value={form.origin}
            onChange={(value) => setForm((prev) => ({ ...prev, origin: value }))}
          />
          <Input
            label="יעד"
            required
            value={form.destination}
            onChange={(value) => setForm((prev) => ({ ...prev, destination: value }))}
          />
          <Input
            label="מחיר"
            type="number"
            value={form.price}
            onChange={(value) => setForm((prev) => ({ ...prev, price: value }))}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn btn-brand" disabled={saving}>
            {saving ? 'פותח...' : 'הוסף ליומן'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-line bg-panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-xl font-extrabold">יומן נסיעות בזמן אמת</h2>
          <p className="text-sm text-muted">{rides.length} נסיעות פעילות ועדכניות</p>
        </div>

        {rides.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted">אין נסיעות בענן עבור התחנה הזו.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">זמן</th>
                  <th className="px-4 py-3 font-semibold">לקוח</th>
                  <th className="px-4 py-3 font-semibold">מסלול</th>
                  <th className="px-4 py-3 font-semibold">מחיר</th>
                  <th className="px-4 py-3 font-semibold">נהג</th>
                  <th className="px-4 py-3 font-semibold">סטטוס</th>
                  <th className="px-4 py-3 font-semibold">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((ride) => {
                  const selectedDriver = assignments[ride.id] || ride.driver_id || ''
                  const assignedDriver =
                    ride.driver_name ||
                    drivers.find((driver) => driver.id === ride.driver_id)?.name ||
                    'טרם שובץ'
                  return (
                    <tr key={ride.id} className="border-t border-line align-top">
                      <td className="px-4 py-4 text-muted whitespace-nowrap">
                        {formatDateTime(ride.created_at)}
                      </td>
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
                      <td className="px-4 py-4 whitespace-nowrap">{formatMoney(ride.price)}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold">{assignedDriver}</div>
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
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={ride.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-52 flex-col gap-2">
                          <button
                            type="button"
                            className="btn btn-brand"
                            disabled={!selectedDriver}
                            onClick={() => assignDriver(ride.id, selectedDriver)}
                          >
                            שבץ נהג
                          </button>
                          <a
                            href={buildWhatsAppShareUrl(ride)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost text-sm"
                          >
                            שתף לוואטסאפ
                          </a>
                          <div className="grid grid-cols-3 gap-1">
                            {['pending', 'assigned', 'completed'].map((status) => (
                              <button
                                key={status}
                                type="button"
                                className={`btn btn-ghost px-2 py-2 text-xs ${
                                  ride.status === status ? 'border-[var(--brand)] text-paper' : ''
                                }`}
                                onClick={() => updateRideStatus(ride.id, status, selectedDriver)}
                              >
                                {RIDE_STATUS_LABELS[status]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function Input({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <input
        className="field"
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function StatusBadge({ status }) {
  const tones = {
    pending: 'bg-amber-950 text-amber-300 border-amber-800',
    assigned: 'bg-sky-950 text-sky-300 border-sky-800',
    completed: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  }

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tones[status] || tones.pending}`}>
      {RIDE_STATUS_LABELS[status] || status}
    </span>
  )
}
