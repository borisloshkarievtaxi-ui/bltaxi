import { Navigate, Route, Routes } from 'react-router-dom'
import PassengerBooking from './components/PassengerBooking.jsx'
import ProtectedDispatch from './components/ProtectedDispatch.jsx'
import AdminLoginScreen from './components/AdminLoginScreen.jsx'
import TenantOnboarding from './components/TenantOnboarding.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProtectedDispatch />} />
      <Route path="/login" element={<AdminLoginScreen />} />
      <Route path="/onboarding" element={<TenantOnboarding />} />
      <Route path="/book" element={<PassengerBooking />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
