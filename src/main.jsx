import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { VerificarCertificado } from './components/Certificados.jsx'
import ResponderCitacion from './components/ResponderCitacion.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { escucharErroresGlobales } from './utils/reportarError'

registerSW({ immediate: true })
escucharErroresGlobales()

// Páginas públicas, sin la app ni sesión: ?verificar=CODIGO (QR de los
// certificados) y ?citacion=TOKEN (enlace de WhatsApp para responder una citación).
const parametros = new URLSearchParams(window.location.search)
const codigoVerificacion = parametros.get('verificar')
const tokenCitacion = parametros.get('citacion')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {codigoVerificacion ? <VerificarCertificado codigo={codigoVerificacion} />
        : tokenCitacion ? <ResponderCitacion token={tokenCitacion} />
          : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
