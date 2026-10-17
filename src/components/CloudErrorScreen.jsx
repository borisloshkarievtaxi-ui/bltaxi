import { useAppData } from '../context/AppDataContext.jsx'

export default function CloudErrorScreen({ message = '' }) {
  const { refresh } = useAppData()

  return (
    <main className="min-h-screen bg-ink text-paper flex items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-3xl border border-line bg-panel p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <p className="mb-2 text-sm font-semibold tracking-[0.18em] text-emerald-400">
          מחובר ל־Supabase Cloud
        </p>
        <h1 className="mb-3 text-3xl font-extrabold">שגיאה בטעינת נתונים מהענן</h1>
        <p className="mb-6 text-base leading-7 text-muted">
          מפתחות ה־<span dir="ltr">.env</span> תקינים, אך הבקשה לבסיס הנתונים נכשלה. בדקו שהטבלאות
          והעמודות תואמות לסכמה של הפרויקט, או נסו לרענן.
        </p>

        {message ? (
          <pre
            className="mb-6 overflow-x-auto rounded-2xl border border-red-900/70 bg-red-950/40 p-4 text-sm leading-6 text-red-100"
            dir="ltr"
          >
            {message}
          </pre>
        ) : null}

        <button type="button" className="btn btn-brand w-full sm:w-auto" onClick={() => refresh()}>
          ניסיון חוזר
        </button>
      </section>
    </main>
  )
}
