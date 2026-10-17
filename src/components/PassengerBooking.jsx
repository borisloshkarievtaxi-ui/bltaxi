import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfigScreen from './ConfigScreen.jsx'
import { useAppData } from '../context/AppDataContext.jsx'

const EMPTY_FORM = {
  client_name: '',
  client_phone: '',
  origin: '',
  destination: '',
  price: '',
}

export default function PassengerBooking() {
  const { configState, tenant, createRide } = useAppData()
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const color = tenant?.primary_color || '#16a34a'
    document.documentElement.style.setProperty('--brand', color)
    document.title = tenant?.business_name
      ? `${tenant.business_name} | הזמנת מונית`
      : 'BLTaxi | הזמנת מונית'
  }, [tenant])

  if (configState === 'missing') {
    return <ConfigScreen reason="missing" />
  }

  const businessName = tenant?.business_name || 'BL Taxi'
  const initial = businessName.trim().charAt(0) || 'B'

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.origin.trim() || !form.destination.trim()) return

    setSubmitting(true)
    const result = await createRide(form)
    setSubmitting(false)

    if (result.success) {
      setSubmitted(true)
      setForm(EMPTY_FORM)
    }
  }

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div
        className="border-b border-line"
        style={{
          background: `linear-gradient(180deg, ${tenant?.primary_color || '#16a34a'}22, transparent)`,
        }}
      >
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-10 text-center">
          {tenant?.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={businessName}
              className="mb-4 h-20 w-20 rounded-3xl border border-line object-cover bg-panel"
            />
          ) : (
            <div
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-3xl font-extrabold"
              style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}
            >
              {initial}
            </div>
          )}
          <h1 className="text-3xl font-extrabold">{businessName}</h1>
          <p className="mt-2 text-muted">הזמנת מונית מהירה — הנתונים נשמרים ישירות בענן</p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8">
        {submitted ? (
          <section
            className="rounded-3xl border p-8 text-center"
            style={{
              borderColor: 'color-mix(in srgb, var(--brand) 40%, #1e3348)',
              background: 'color-mix(in srgb, var(--brand) 12%, #0e1a26)',
            }}
          >
            <p className="text-4xl mb-4">✓</p>
            <h2 className="text-2xl font-extrabold">הזמנתך התקבלה בהצלחה! מונית בדרך אליך</h2>
            <p className="mt-3 text-sm text-muted">הנסיעה נרשמה במוקד השיגור ותטופל בהקדם.</p>
            <button
              type="button"
              className="btn btn-brand mt-6 w-full"
              onClick={() => setSubmitted(false)}
            >
              הזמנה נוספת
            </button>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-line bg-panel p-6">
            <h2 className="text-xl font-extrabold">פרטי הנסיעה</h2>

            <Field label="שם הנוסע">
              <input
                className="field"
                required
                value={form.client_name}
                onChange={(e) => setForm((prev) => ({ ...prev, client_name: e.target.value }))}
              />
            </Field>

            <Field label="טלפון נוסע">
              <input
                className="field"
                required
                dir="ltr"
                type="tel"
                value={form.client_phone}
                onChange={(e) => setForm((prev) => ({ ...prev, client_phone: e.target.value }))}
              />
            </Field>

            <Field label="נקודת איסוף (מוצא)">
              <input
                className="field"
                required
                value={form.origin}
                onChange={(e) => setForm((prev) => ({ ...prev, origin: e.target.value }))}
              />
            </Field>

            <Field label="יעד">
              <input
                className="field"
                required
                value={form.destination}
                onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value }))}
              />
            </Field>

            <Field label="מחיר משוער (₪)">
              <input
                className="field"
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </Field>

            <button type="submit" className="btn btn-brand w-full" disabled={submitting}>
              {submitting ? 'שולח הזמנה...' : 'שליחת הזמנה'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          <Link to="/" className="text-emerald-300 hover:text-emerald-200">
            כניסה למוקד שיגור
          </Link>
        </p>
      </div>
    </main>
  )
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  )
}
