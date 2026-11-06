// Envío de correos (códigos de acceso). Configuración por variables de
// entorno (ver ENV_VARIABLES.md): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
// SMTP_SECURE (opcional) y EMAIL_FROM.
//
// Sin SMTP configurado:
//  - en desarrollo (NODE_ENV != production) los correos se escriben como
//    JSON en backend/.correos-dev/ (no se envía nada); las pruebas E2E leen
//    el código desde ahí.
//  - en producción, correoDisponible() es false y la API responde que el
//    envío no está configurado (el frontend ofrece WhatsApp del club).
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const CARPETA_DEV = path.join(__dirname, '..', '.correos-dev');

const configSmtp = () => {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  return { host, port, secure, auth: { user, pass } };
};

const esProduccion = () => String(process.env.NODE_ENV || '').toLowerCase() === 'production';

const modoCorreo = () => {
  if (configSmtp()) return 'smtp';
  if (!esProduccion()) return 'archivo';
  return 'deshabilitado';
};

const correoDisponible = () => modoCorreo() !== 'deshabilitado';

let transporte = null;
const obtenerTransporte = () => {
  if (!transporte) transporte = nodemailer.createTransport(configSmtp());
  return transporte;
};

const remitente = () => String(process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@club.local').trim();

const enviarCorreo = async ({ para, asunto, texto, html }) => {
  const modo = modoCorreo();
  if (modo === 'deshabilitado') {
    throw new Error('El envío de correos no está configurado.');
  }
  if (modo === 'archivo') {
    fs.mkdirSync(CARPETA_DEV, { recursive: true });
    const archivo = path.join(CARPETA_DEV, `${Date.now()}-${String(para).replace(/[^a-z0-9@._-]/gi, '_')}.json`);
    fs.writeFileSync(archivo, JSON.stringify({ para, asunto, texto, html, creado: new Date().toISOString() }, null, 2));
    console.log(`[CORREO-DEV] "${asunto}" para ${para} guardado en ${path.basename(archivo)} (no se envió).`);
    return { modo };
  }
  await obtenerTransporte().sendMail({ from: remitente(), to: para, subject: asunto, text: texto, html });
  return { modo };
};

// "beparra1@gmail.com" -> "be*****1@gmail.com" (para mostrar a dónde se envió
// el código sin exponer la dirección completa).
const enmascararCorreo = (correo = '') => {
  const [usuario, dominio] = String(correo).split('@');
  if (!usuario || !dominio) return '';
  const visibleIni = usuario.slice(0, Math.min(2, usuario.length));
  const visibleFin = usuario.length > 4 ? usuario.slice(-1) : '';
  return `${visibleIni}${'*'.repeat(Math.max(3, usuario.length - visibleIni.length - visibleFin.length))}${visibleFin}@${dominio}`;
};

const esCorreoReal = (correo = '') => {
  const c = String(correo || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c)) return false;
  return !c.endsWith('@actualizar.local');
};

module.exports = { enviarCorreo, correoDisponible, modoCorreo, enmascararCorreo, esCorreoReal, CARPETA_DEV };
