import { Navigate } from 'react-router-dom'
import DispatchDashboard from '../DispatchDashboard.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import AdminLoginScreen from './AdminLoginScreen.jsx'

export default function ProtectedDispatch() {
  const { ready, isAdminAuthenticated } = useAuth()

  if (!ready) {
    return null
  }

  if (!isAdminAuthenticated) {
    return <AdminLoginScreen />
  }

  return <DispatchDashboard />
}
