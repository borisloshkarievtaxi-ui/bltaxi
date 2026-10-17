import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DispatchDashboard from './DispatchDashboard.jsx'
import PassengerBooking from './components/PassengerBooking.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DispatchDashboard />} />
        <Route path="/book" element={<PassengerBooking />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
