// Envía al servidor los errores que ocurren en el navegador (Panel →
// Sistema → Errores recientes). Antes solo quedaban en la consola del
// celular de la familia, donde nadie podía verlos.
import { erroresAppAPI } from '../api/client';

let pantallaActual = '';
const enviados = new Map(); // mensaje → último envío (ms)
let totalSesion = 0;
const MAX_POR_SESION = 15;
const ESPERA_MISMO_ERROR_MS = 60 * 1000;

// App.jsx la actualiza al cambiar de pantalla, para saber dónde pasó.
export const setPantallaParaErrores = (texto) => { pantallaActual = String(texto || ''); };

const IGNORAR = [
  /ResizeObserver loop/i, // aviso inofensivo del navegador
  /chrome-extension:|moz-extension:|safari-extension:/i, // extensiones del usuario
  /^Script error\.?$/i, // error de otro dominio sin detalle
];

export const reportarError = ({ mensaje, detalle = '' } = {}) => {
  const texto = String(mensaje || '').trim();
  if (!texto || IGNORAR.some((r) => r.test(texto) || r.test(String(detalle)))) return;
  const ahora = Date.now();
  const clave = `${pantallaActual}|${texto}`;
  if (totalSesion >= MAX_POR_SESION || ahora - (enviados.get(clave) || 0) < ESPERA_MISMO_ERROR_MS) return;
  enviados.set(clave, ahora);
  totalSesion += 1;
  void erroresAppAPI.reportar({
    mensaje: texto,
    detalle: String(detalle || ''),
    pantalla: pantallaActual,
    url: typeof window !== 'undefined' ? window.location.pathname : '',
  });
};

// Errores fuera de React (promesas sin catch, callbacks). Se llama una vez
// desde main.jsx.
export const escucharErroresGlobales = () => {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    // e.message trae el prefijo 'Uncaught Error:'; el del error es el original.
    reportarError({ mensaje: e.error?.message || e.message || '', detalle: e.error?.stack || `${e.filename || ''}:${e.lineno || ''}` });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    // Errores de red/API ya se muestran al usuario con un aviso: solo
    // interesan los errores de programación.
    if (r && typeof r === 'object' && 'status' in r) return;
    reportarError({ mensaje: r?.message || String(r || 'Promesa rechazada'), detalle: r?.stack || '' });
  });
};
