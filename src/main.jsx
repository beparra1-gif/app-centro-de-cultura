import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { VerificarCertificado } from './components/Certificados.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { escucharErroresGlobales } from './utils/reportarError'

registerSW({ immediate: true })
escucharErroresGlobales()

// Página pública, sin la app ni sesión: ?verificar=CODIGO (QR de los certificados).
// El enlace de citaciones (?partido=) lo maneja App: exige iniciar sesión.
const codigoVerificacion = new URLSearchParams(window.location.search).get('verificar')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {codigoVerificacion ? <VerificarCertificado codigo={codigoVerificacion} /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
