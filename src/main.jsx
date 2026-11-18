import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './services/instalacion'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// El service worker solo se registra en la versión compilada (npm run build):
// en desarrollo (Vite) guardaría archivos viejos y confundiría la recarga en caliente.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
