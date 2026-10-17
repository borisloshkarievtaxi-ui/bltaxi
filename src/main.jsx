import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AppDataProvider } from './context/AppDataContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </StrictMode>,
)
