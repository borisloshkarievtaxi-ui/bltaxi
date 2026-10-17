import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppDataProvider } from './context/AppDataContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'
import { verifySupabaseConnectionOnStartup } from './lib/supabaseConnectionCheck.js'

verifySupabaseConnectionOnStartup()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppDataProvider>
          <App />
        </AppDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
