import { getSupabaseEnv } from '../lib/supabase.js'

export default function ConfigScreen({ reason = 'missing', errorMessage = '' }) {
  const env = getSupabaseEnv()

  return (
    <main className="min-h-screen bg-ink text-paper flex items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-3xl border border-line bg-panel p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-lg font-extrabold text-[var(--brand-contrast)]">
          BL
        </div>
        <p className="mb-2 text-sm font-semibold tracking-[0.18em] text-muted">BLTAXI WHITE LABEL</p>
        <h1 className="mb-3 text-3xl font-extrabold">
          {reason === 'invalid' ? (
            'מפתחות הענן אינם תקינים'
          ) : (
            <>
              חסר חיבור ל־
              <span dir="ltr">Supabase Cloud</span>
            </>
          )}
        </h1>
        <p className="mb-6 text-base leading-7 text-muted">
          מוקד השיגור עובד בענן בלבד — בלי localStorage. מלאו את המשתנים הבאים בקובץ
          <span className="mx-1 font-bold text-paper">.env</span>
          ואז הפעילו מחדש את האפליקציה.
        </p>

        <div className="mb-6 space-y-3 rounded-2xl border border-line bg-ink p-4 font-mono text-sm">
          <EnvRow
            name="VITE_SUPABASE_URL"
            value={env.url || 'חסר'}
            ok={Boolean(env.url) && env.url !== 'https://your-project.supabase.co'}
          />
          <EnvRow
            name="VITE_SUPABASE_ANON_KEY"
            value={env.anonKey ? maskKey(env.anonKey) : 'חסר'}
            ok={Boolean(env.anonKey) && env.anonKey !== 'your-anon-key'}
          />
        </div>

        <pre className="mb-6 overflow-x-auto rounded-2xl bg-black/30 p-4 text-sm leading-7 text-emerald-200" dir="ltr">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>

        {errorMessage ? (
          <p className="mb-6 rounded-2xl border border-red-900/70 bg-red-950/60 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </p>
        ) : null}

        <ol className="space-y-2 text-sm leading-6 text-muted">
          <li>1. העתיקו את `.env.example` אל `.env` אם עדיין אין קובץ כזה.</li>
          <li>2. הדביקו את כתובת הפרויקט ואת ה־anon key מתוך Supabase.</li>
          <li>3. הריצו מחדש `npm run dev` כדי לטעון את משתני הסביבה.</li>
        </ol>
      </section>
    </main>
  )
}

function maskKey(value) {
  if (value.length <= 10) return '••••••••'
  return `${value.slice(0, 6)}••••${value.slice(-4)}`
}

function EnvRow({ name, value, ok }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-emerald-100" dir="ltr">
        {name}
      </span>
      <span className={ok ? 'text-emerald-400' : 'text-amber-300'}>{value}</span>
    </div>
  )
}
