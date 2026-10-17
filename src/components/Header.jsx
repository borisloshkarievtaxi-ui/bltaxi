export default function Header({
  tenant,
  activeTab,
  onTabChange,
  onLogout,
  showDevLogout = false,
}) {
  const logo = tenant?.logo_url
  const name = tenant?.business_name || 'BL Taxi'
  const phone = tenant?.phone_number?.trim()
  const initial = name.trim().charAt(0) || 'B'
  const whatsappHref = phone
    ? `https://wa.me/${phone.replace(/\D/g, '')}`
    : null

  return (
    <header className="border-b border-line bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
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
            <p className="text-xs font-semibold tracking-[0.16em] text-muted">BLTAXI DISPATCH</p>
            <h1 className="text-2xl font-extrabold leading-none gold-text">{name}</h1>
            {phone ? (
              <p className="mt-1 text-sm text-muted" dir="ltr">
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:text-[var(--brand)]"
                  >
                    {phone}
                  </a>
                ) : (
                  phone
                )}
              </p>
            ) : null}
          </div>
        </div>

        {showDevLogout && onLogout ? (
          <button type="button" className="btn btn-pill px-3 py-1.5 text-xs" onClick={onLogout}>
            יציאה (DEV)
          </button>
        ) : null}
      </div>

      <nav className="mx-auto flex max-w-[1400px] gap-2 overflow-x-auto px-4 pb-4">
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
        active ? 'bg-[var(--brand)] text-[var(--brand-contrast)]' : 'chip hover:text-paper'
      }`}
    >
      {children}
    </button>
  )
}
