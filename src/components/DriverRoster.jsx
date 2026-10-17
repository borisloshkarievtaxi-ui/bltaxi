import { useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'
import { formatBalance } from '../lib/format.js'

const EMPTY_DRIVER = {
  name: '',
  phone: '',
  status: 'available',
  balance: '0',
}

export default function DriverRoster() {
  const { drivers, createDriver, updateDriverStatus } = useAppData()
  const [form, setForm] = useState(EMPTY_DRIVER)
  const [saving, setSaving] = useState(false)

  async function handleCreate(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const result = await createDriver(form)
    setSaving(false)
    if (!result.error) setForm(EMPTY_DRIVER)
  }

  return (
    <section className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="text-xl font-extrabold">הוספת נהג</h2>
        <p className="mb-4 text-sm text-muted">הנהג יישמר ישירות ברשימת התחנה בענן</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">שם הנהג</span>
            <input
              className="field"
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">טלפון</span>
            <input
              className="field"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">סטטוס</span>
            <select
              className="field"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="available">פנוי</option>
              <option value="busy">בנסיעה</option>
              <option value="offline">לא זמין</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">יתרה</span>
            <input
              className="field"
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(event) => setForm((prev) => ({ ...prev, balance: event.target.value }))}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn btn-brand" disabled={saving}>
            {saving ? 'מוסיף...' : 'הוסף נהג'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-line bg-panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-xl font-extrabold">נהגים פעילים</h2>
          <p className="text-sm text-muted">{drivers.length} נהגים מחוברים לתחנה</p>
        </div>

        {drivers.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted">אין נהגים פעילים בענן.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">נהג</th>
                  <th className="px-4 py-3 font-semibold">טלפון</th>
                  <th className="px-4 py-3 font-semibold">סטטוס</th>
                  <th className="px-4 py-3 font-semibold">יתרה</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id} className="border-t border-line">
                    <td className="px-4 py-4 font-bold">{driver.name}</td>
                    <td className="px-4 py-4 text-muted" dir="ltr">
                      {driver.phone || '—'}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        className="field max-w-44"
                        value={driver.status}
                        onChange={(event) => updateDriverStatus(driver.id, event.target.value)}
                      >
                        <option value="available">פנוי</option>
                        <option value="busy">בנסיעה</option>
                        <option value="offline">לא זמין</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 font-bold">{formatBalance(driver.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
