import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandingSettings from './components/BrandingSettings.jsx'
import CloudErrorScreen from './components/CloudErrorScreen.jsx'
import ConfigScreen from './components/ConfigScreen.jsx'
import DriverRoster from './components/DriverRoster.jsx'
import Header from './components/Header.jsx'
import RideDispatchLog from './components/RideDispatchLog.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { useAppData } from './context/AppDataContext.jsx'

export default function DispatchDashboard() {
  const { logoutAdmin, isDevEnvironment } = useAuth()
  const { configState, connectionError, loading, tenant } = useAppData()
  const [tab, setTab] = useState('rides')

  useEffect(() => {
    document.documentElement.style.setProperty('--brand', tenant?.primary_color || '#facc15')
    document.documentElement.style.setProperty('--brand-contrast', '#1a1400')
    document.title = tenant?.business_name
      ? `${tenant.business_name} | מוקד שיגור`
      : 'BLTaxi | מוקד שיגור'
  }, [tenant])

  if (configState === 'missing') {
    return <ConfigScreen reason="missing" />
  }

  if (connectionError && !loading) {
    return <CloudErrorScreen message={connectionError} />
  }

  return (
    <div className="min-h-screen bg-ink text-paper">
      <Header
        tenant={tenant}
        activeTab={tab}
        onTabChange={setTab}
        onLogout={logoutAdmin}
        showDevLogout={isDevEnvironment}
      />

      <div className="mx-auto max-w-[1400px] px-4 pt-2">
        <Link to="/book" className="text-xs font-semibold text-zinc-400 hover:text-[var(--brand)]">
          ← אתר הזמנות לנוסעים
        </Link>
      </div>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        {tab === 'rides' ? <RideDispatchLog /> : null}
        {tab === 'drivers' ? <DriverRoster /> : null}
        {tab === 'settings' ? <BrandingSettings /> : null}
      </main>
    </div>
  )
}
