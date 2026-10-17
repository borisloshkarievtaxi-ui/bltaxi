import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { createAdminSession } from '../lib/auth.js'
import {
  DEFAULT_ONBOARDING_PRIMARY,
  normalizeTenantSlug,
  provisionTenantFromOnboarding,
} from '../lib/onboarding.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import ConfigScreen from './ConfigScreen.jsx'

const INITIAL_FORM = {
  business_name: '',
  slug: '',
  phone: '',
  logo_url: '',
  primary_color: DEFAULT_ONBOARDING_PRIMARY,
}

export default function TenantOnboarding() {
  const navigate = useNavigate()
  const { ready, setAdminSession } = useAuth()
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const previewSlug = useMemo(() => normalizeTenantSlug(form.slug) || 'your-station', [form.slug])

  useEffect(() => {
    document.documentElement.style.setProperty('--brand', form.primary_color || DEFAULT_ONBOARDING_PRIMARY)
    document.documentElement.style.setProperty('--brand-contrast', '#1a1400')
    document.title = 'הקמת תחנה חדשה | BLTaxi'
  }, [form.primary_color])

  if (!isSupabaseConfigured()) {
    return <ConfigScreen reason="missing" />
  }

  if (!ready) {
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await provisionTenantFromOnboarding(form)

      if (result.error) {
        setError(result.error)
        setSubmitting(false)
        return
      }

      const tenant = result.data
      setAdminSession(
        createAdminSession({
          tenantSlug: tenant.slug,
          tenantId: tenant.id,
          provider: 'onboarding',
        }),
      )

      navigate(`/?tenant=${encodeURIComponent(tenant.slug)}`, {
        replace: true,
        state: { onboardedTenantId: tenant.id },
      })
    } catch (error) {
      console.error('[BLTaxi DB] onboarding submit exception', error)
      setError(String(error?.message ?? error))
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-ink text-paper px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="mb-2 text-sm font-semibold tracking-[0.18em] text-muted">BLTAXI ONBOARDING</p>
        <h1 className="mb-2 text-3xl font-extrabold">הקמת תחנה חדשה</h1>
        <p className="mb-8 text-sm leading-7 text-muted">
          הטופס יוצר תחנה חדשה ב-Supabase, מקצה מזהה ייחודי, ומעביר אותך ישירות למוקד השיגור הממותג שלך.
        </p>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-line bg-panel p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-8"
        >
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-bold">שם התחנה</span>
              <input
                className="field"
                value={form.business_name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, business_name: event.target.value }))
                }
                placeholder="לדוגמה: וולד מוניות"
                required
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-bold">מזהה כתובת (Slug)</span>
              <input
                className="field"
                dir="ltr"
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="vold-taxis"
                required
              />
              <span className="mt-1.5 block text-xs text-muted" dir="ltr">
                bltaxi.app/book?tenant={previewSlug} · session: {previewSlug}
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-bold">טלפון / WhatsApp</span>
              <input
                className="field"
                dir="ltr"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+972501234567"
                required
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-bold">כתובת לוגו (אופציונלי)</span>
              <input
                className="field"
                dir="ltr"
                type="url"
                value={form.logo_url}
                onChange={(event) => setForm((prev) => ({ ...prev, logo_url: event.target.value }))}
                placeholder="https://example.com/logo.png"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">צבע מותג ראשי</span>
              <input
                className="field h-12 cursor-pointer p-1"
                type="color"
                value={form.primary_color}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, primary_color: event.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">HEX</span>
              <input
                className="field"
                dir="ltr"
                value={form.primary_color}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, primary_color: event.target.value }))
                }
              />
            </label>
          </div>

          <div
            className="mb-6 rounded-2xl border border-line p-4"
            style={{ background: `${form.primary_color}14` }}
          >
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted">תצוגה מקדימה</p>
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt=""
                  className="h-12 w-12 rounded-2xl border border-line object-cover bg-ink"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-extrabold"
                  style={{
                    background: form.primary_color,
                    color: 'var(--brand-contrast)',
                  }}
                >
                  {(form.business_name || 'B').trim().charAt(0) || 'B'}
                </div>
              )}
              <div>
                <p className="text-lg font-extrabold brand-text">{form.business_name || 'שם התחנה'}</p>
                <p className="text-xs text-muted" dir="ltr">
                  tenant_id ייווצר בעת השמירה
                </p>
              </div>
            </div>
          </div>

          {error ? (
            <p className="mb-4 rounded-2xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-brand w-full" disabled={submitting}>
            {submitting ? 'שומר בענן…' : 'יצירת תחנה ומעבר למוקד השיגור'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/login" className="font-semibold brand-text hover:opacity-90">
            חזרה לכניסת מנהל
          </Link>
          <span className="mx-2">·</span>
          <Link to="/book" className="text-zinc-400 hover:text-paper">
            הזמנת נוסעים
          </Link>
        </p>
      </div>
    </main>
  )
}
