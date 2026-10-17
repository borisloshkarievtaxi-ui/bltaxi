export default function Header({ tenant, activeTab, onTabChange }) {
  const logo = tenant?.logo_url
  const name = tenant?.business_name || 'BLTaxi'
  const initial = name.trim().charAt(0) || 'B'

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

        <div className="flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/70 px-3 py-1.5 text-emerald-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-extrabold tracking-[0.08em]">CONNECTED TO SUPABASE CLOUD</span>
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
