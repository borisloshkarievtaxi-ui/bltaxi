export default function LoadingScreen() {
  return (
    <main className="min-h-screen bg-ink text-paper flex items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-line border-t-[var(--brand)]" />
        <p className="text-lg font-bold">טוען נתונים מהענן</p>
        <p className="mt-2 text-sm text-muted">תחנה, נהגים פעילים ונסיעות פעילות</p>
      </div>
    </main>
  )
}
