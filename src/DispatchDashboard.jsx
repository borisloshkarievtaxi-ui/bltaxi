import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandingSettings from './components/BrandingSettings.jsx'
import ConfigScreen from './components/ConfigScreen.jsx'
import ConnectionBanner from './components/ConnectionBanner.jsx'
import DriverRoster from './components/DriverRoster.jsx'
import Header from './components/Header.jsx'
import RideDispatchLog from './components/RideDispatchLog.jsx'
import { useAppData } from './context/AppDataContext.jsx'

export default function DispatchDashboard() {
  const { configState, connectionError, loading, cloudConnected, tenant, notice, refresh } =
    useAppData()
  const [tab, setTab] = useState('rides')

  useEffect(() => {
    const color = tenant?.primary_color || '#16a34a'
    document.documentElement.style.setProperty('--brand', color)
    document.title = tenant?.business_name
      ? `${tenant.business_name} | מוקד שיגור`
      : 'BLTaxi | מוקד שיגור'
  }, [tenant])

  if (configState === 'missing') {
    return <ConfigScreen reason="missing" />
  }

  return (
    <div className="min-h-screen bg-ink text-paper">
      <Header
        tenant={tenant}
        activeTab={tab}
        onTabChange={setTab}
        cloudConnected={cloudConnected}
        syncing={loading}
      />

      <div className="mx-auto max-w-7xl px-4 pt-3">
        <Link
          to="/book"
          className="inline-flex text-sm font-semibold text-emerald-300 hover:text-emerald-200"
        >
          ← אתר הזמנות לנוסעים
        </Link>
      </div>

      <ConnectionBanner message={connectionError} loading={loading} onRetry={refresh} />

      {notice ? (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <p
            className={`rounded-2xl px-4 py-3 text-sm ${
              notice.type === 'error'
                ? 'border border-red-900 bg-red-950 text-red-100'
                : 'border border-emerald-900 bg-emerald-950 text-emerald-100'
            }`}
          >
            {notice.message}
          </p>
        </div>
      ) : null}

      <main className="mx-auto max-w-7xl px-4 py-6">
        {!tenant ? (
          <section className="rounded-3xl border border-line bg-panel p-8 text-center">
            <h2 className="text-2xl font-extrabold">
              {connectionError ? 'לא הצלחנו לטעון את התחנה' : 'התחנה bltaxi-demo לא נמצאה'}
            </h2>
            <p className="mt-2 text-muted">
              {connectionError
                ? 'הממשק זמין — לחצו «ניסיון חוזר» כדי לסנכרן מחדש עם Supabase.'
                : 'החיבור לענן תקין, אבל חסרה רשומת tenant עם slug בשם bltaxi-demo.'}
            </p>
          </section>
        ) : null}

        {tenant && tab === 'rides' ? <RideDispatchLog /> : null}
        {tenant && tab === 'drivers' ? <DriverRoster /> : null}
        {tab === 'settings' ? <BrandingSettings /> : null}
      </main>
    </div>
  )
}
