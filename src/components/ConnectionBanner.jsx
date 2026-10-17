export default function ConnectionBanner({ message, loading, onRetry }) {
  if (!message && !loading) return null

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-800/80 bg-amber-950/50 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {loading
            ? 'מתחבר מחדש ל־Supabase Cloud…'
            : message || 'לא הצלחנו לטעון נתונים מהענן. אפשר להמשיך לעבוד ולנסות שוב.'}
        </p>
        {!loading && onRetry ? (
          <button type="button" className="btn btn-ghost shrink-0 text-xs" onClick={onRetry}>
            ניסיון חוזר
          </button>
        ) : null}
      </div>
    </div>
  )
}
