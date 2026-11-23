// Avisos nativos en el teléfono (Web Push). Android y computadores los
// reciben desde el navegador; en iPhone solo si la app está instalada en la
// pantalla de inicio (iOS 16.4 o superior).
import * as api from '../api/client';

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
export const appInstalada = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// 'no-soportado' | 'instalar-ios' | 'bloqueado' | 'activado' | 'pendiente'
export const estadoAvisos = async () => {
  if (esIOS() && !appInstalada()) return 'instalar-ios';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  if (Notification.permission === 'granted') {
    const registro = await navigator.serviceWorker.getRegistration();
    const sub = await registro?.pushManager.getSubscription();
    return sub ? 'activado' : 'pendiente';
  }
  return 'pendiente';
};

const claveABytes = (base64) => {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
};

// Pide permiso (debe llamarse desde un toque del usuario) y registra este
// teléfono en el backend para la cuenta que inició sesión.
export const activarAvisos = async () => {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No diste permiso para mostrar avisos.');
  const registro = await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushAPI.clavePublica();
  const suscripcion = await registro.pushManager.getSubscription()
    || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(publicKey) });
  await api.pushAPI.suscribir(suscripcion.toJSON());
};
