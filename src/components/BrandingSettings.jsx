import { useEffect, useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'

export default function BrandingSettings() {
  const { tenant, updateTenant } = useAppData()
  const [form, setForm] = useState({
    business_name: '',
    phone_number: '',
    primary_color: '#16a34a',
    default_commission: 15,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenant) return
    setForm({
      business_name: tenant.business_name || '',
      phone_number: tenant.phone_number || '',
      primary_color: tenant.primary_color || '#16a34a',
      default_commission: tenant.default_commission ?? 15,
    })
  }, [tenant])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    await updateTenant(form)
    setSaving(false)
  }

  if (!tenant) {
    return (
      <section className="rounded-3xl border border-line bg-panel p-8 text-center">
        <h2 className="text-2xl font-extrabold">טוען הגדרות תחנה…</h2>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-line bg-panel p-6">
      <h2 className="text-xl font-extrabold">הגדרות תחנה</h2>
      <p className="mb-6 text-sm text-muted">השם, הצבע והעמלה נשמרים ישירות ב־Supabase</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">שם העסק</span>
          <input
            className="field"
            required
            value={form.business_name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, business_name: event.target.value }))
            }
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">טלפון תחנה</span>
          <input
            className="field"
            dir="ltr"
            value={form.phone_number}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, phone_number: event.target.value }))
            }
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">צבע ראשי</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              className="h-12 w-16 rounded-xl border border-line bg-ink p-1"
              value={form.primary_color}
              onChange={(event) => setForm((prev) => ({ ...prev, primary_color: event.target.value }))}
            />
            <input
              className="field"
              dir="ltr"
              value={form.primary_color}
              onChange={(event) => setForm((prev) => ({ ...prev, primary_color: event.target.value }))}
            />
          </div>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">עמלת ברירת מחדל (%)</span>
          <input
            className="field"
            type="number"
            min="0"
            max="100"
            step="0.5"
            required
            value={form.default_commission}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, default_commission: event.target.value }))
            }
          />
        </label>

        <div
          className="rounded-2xl border border-line p-4"
          style={{ background: `${form.primary_color}14` }}
        >
          <p className="text-sm text-muted">תצוגה מקדימה</p>
          <div className="mt-3 flex items-center justify-between">
            <strong>{form.business_name || 'שם העסק'}</strong>
            <span
              className="rounded-full px-3 py-1 text-xs font-extrabold"
              style={{ background: form.primary_color, color: '#06210f' }}
            >
              עמלה {form.default_commission}%
            </span>
          </div>
        </div>

        <button type="submit" className="btn btn-brand w-full" disabled={saving}>
          {saving ? 'שומר בענן...' : 'שמירת הגדרות'}
        </button>
      </form>
    </section>
  )
}
