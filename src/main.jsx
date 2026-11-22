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

// El QR de los certificados abre ?verificar=CODIGO: página pública, sin la app ni sesión.
const codigoVerificacion = new URLSearchParams(window.location.search).get('verificar')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {codigoVerificacion ? <VerificarCertificado codigo={codigoVerificacion} /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
