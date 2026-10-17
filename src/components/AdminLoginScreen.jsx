import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { isSupabaseConfigured, TENANT_SLUG } from '../lib/supabase.js'
import ConfigScreen from './ConfigScreen.jsx'

export default function AdminLoginScreen() {
  const { loginDevAdmin, isDevEnvironment, ready, isAdminAuthenticated } = useAuth()

  useEffect(() => {
    if (!ready || !isDevEnvironment || !isSupabaseConfigured()) return
    loginDevAdmin(TENANT_SLUG)
  }, [ready, isDevEnvironment, loginDevAdmin])

  if (!isSupabaseConfigured()) {
    return <ConfigScreen reason="missing" />
  }

  if (isAdminAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-ink text-paper flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-3xl border border-line bg-panel p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <p className="mb-2 text-sm font-semibold tracking-[0.18em] text-muted">BLTAXI ADMIN</p>
        <h1 className="mb-3 text-3xl font-extrabold">כניסה למוקד השיגור</h1>
        <p className="mb-6 text-sm leading-7 text-muted">
          מצב פיתוח זמני — כניסה מהירה טוענת את תחנת
          <span className="mx-1 font-bold text-paper" dir="ltr">
            {TENANT_SLUG}
          </span>
          מ־Supabase (נסיעות, נהגים והגדרות).
        </p>

        {isDevEnvironment ? (
          <p className="mb-4 rounded-2xl border border-sky-900 bg-sky-950/50 px-4 py-3 text-sm text-sky-100">
            מצב DEV פעיל — מתחבר אוטומטית לתחנת הדמו…
          </p>
        ) : null}

        <button
          type="button"
          className="btn btn-brand mb-4 w-full"
          onClick={() => loginDevAdmin(TENANT_SLUG)}
        >
          Quick Admin Login
        </button>

        <p className="text-center text-sm text-muted">
          <Link to="/onboarding" className="font-semibold text-[#fde047] hover:text-[#facc15]">
            הקמת תחנה חדשה
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-muted">
          <Link to="/book" className="text-emerald-300 hover:text-emerald-200">
            מעבר להזמנת נוסעים (ללא כניסת מנהל)
          </Link>
        </p>

        <p className="mt-6 text-xs leading-5 text-muted">
          בעתיד: כאן יחובר Supabase Auth אמיתי. מזהה התחנה (`tenantSlug`) וה־`tenant_id` בבקשות
          יישארו ללא שינוי.
        </p>
      </section>
    </main>
  )
}
