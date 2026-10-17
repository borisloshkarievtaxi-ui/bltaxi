export default function Header({
  tenant,
  activeTab,
  onTabChange,
  cloudConnected = false,
  syncing = false,
  onLogout,
  showDevLogout = false,
}) {
  const logo = tenant?.logo_url
  const name = tenant?.business_name || 'BLTaxi'
  const initial = name.trim().charAt(0) || 'B'

  const statusLabel = syncing
    ? 'SYNCING WITH SUPABASE CLOUD'
    : cloudConnected
      ? 'CONNECTED TO SUPABASE CLOUD'
      : 'CLOUD RECONNECTING'

  const statusTone = syncing
    ? 'border-sky-800 bg-sky-950/70 text-sky-300'
    : cloudConnected
      ? 'border-emerald-800 bg-emerald-950/70 text-emerald-300'
      : 'border-amber-800 bg-amber-950/70 text-amber-300'

  const dotTone = syncing ? 'bg-sky-400' : cloudConnected ? 'bg-emerald-400' : 'bg-amber-400'

  return (
    <header className="border-b border-line bg-panel/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          {logo ? (
            <img
              src={logo}
              alt={name}
              className="h-12 w-12 rounded-2xl border border-line object-cover bg-ink"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-extrabold"
              style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}
            >
              {initial}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-muted">מוקד שיגור</p>
            <h1 className="text-2xl font-extrabold leading-none">{name}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${statusTone}`}>
            <span className="relative flex h-2.5 w-2.5">
              {!syncing && cloudConnected ? (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotTone} opacity-70`}
                />
              ) : null}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotTone}`} />
            </span>
            <span className="text-xs font-extrabold tracking-[0.08em]">{statusLabel}</span>
          </div>
          {showDevLogout && onLogout ? (
            <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={onLogout}>
              יציאה (DEV)
            </button>
          ) : null}
        </div>
      </div>

      <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4">
        <TabButton active={activeTab === 'rides'} onClick={() => onTabChange('rides')}>
          יומן נסיעות
        </TabButton>
        <TabButton active={activeTab === 'drivers'} onClick={() => onTabChange('drivers')}>
          ניהול נהגים
        </TabButton>
        <TabButton active={activeTab === 'settings'} onClick={() => onTabChange('settings')}>
          הגדרות תחנה
        </TabButton>
      </nav>
    </header>
  )
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        active
          ? 'text-[var(--brand-contrast)]'
          : 'border border-line bg-panel-2 text-muted hover:text-paper'
      }`}
      style={active ? { background: 'var(--brand)' } : undefined}
    >
      {children}
    </button>
  )
}
