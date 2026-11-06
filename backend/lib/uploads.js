// Configuración compartida de subidas (multer en memoria, directorio de logos, cabeceras seguras).
// Extraído de server.js sin cambios de comportamiento.
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const logosPublicDir = path.join(__dirname, '..', 'public', 'logos');
fs.mkdirSync(logosPublicDir, { recursive: true });

// Archivos subidos por usuarios se sirven desde el mismo origen que la app:
// un SVG puede traer <script>, y abrirlo directo ejecutaba ese JS con acceso
// al localStorage (donde vive el token de sesión). nosniff evita que el
// navegador reinterprete el tipo, y el CSP sandbox desactiva scripts en SVG.
// (No se aplica sandbox a PDFs: rompe el visor de PDF de Chrome.)
const aplicarCabecerasArchivoSubido = (res, mimeType = '') => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (String(mimeType).toLowerCase().includes('svg')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
};

// SVG solo para logos que sube un admin por /api/logo-assets (esa ruta exige
// admin_dashboard después de multer para cualquier tipo que no sea de
// autoservicio). Foto de perfil, comprobante y fotos de jugador las sube
// cualquier familia: ahí solo imágenes rasterizadas, y PDF para comprobantes.
const MIMES_RASTER = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const uploadLogoMemoria = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const tipo = String(req.body?.tipo || 'logo').trim() || 'logo';
    const esRutaLogosAdmin = req.path === '/api/logo-assets' && !TIPOS_LOGO_ASSET_AUTOSERVICIO.includes(tipo);
    const permitido = [
      ...MIMES_RASTER,
      ...(esRutaLogosAdmin ? ['image/svg+xml'] : []),
      ...(req.path === '/api/logo-assets' && tipo === 'comprobante' ? ['application/pdf'] : []),
    ];
    if (!permitido.includes(file.mimetype)) {
      cb(new Error(tipo === 'comprobante'
        ? 'Formato no permitido. Usa una imagen (PNG, JPG, WEBP) o un PDF.'
        : `Formato no permitido. Usa PNG, JPG o WEBP${esRutaLogosAdmin ? ' o SVG' : ''}.`));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Endpoint genérico de subida de imágenes, reutilizado por flujos que NO son
// de administración: foto de perfil en onboarding (tipo 'perfil') y
// comprobante de pago en Tesorería (tipo 'comprobante') — ambos los sube el
// propio apoderado/socio, no un admin. Antes exigía admin_dashboard siempre,
// lo que rompía la subida de comprobante para cualquier no-admin ("No tienes
// acceso a este módulo"). El resto de los tipos (logo de club, foto de
// jugador desde el panel admin, etc.) se mantienen exclusivos de admin.
// multer debe ir ANTES de leer req.body.tipo: en multipart/form-data el
// body recién queda poblado después de que multer lo parsea.
const TIPOS_LOGO_ASSET_AUTOSERVICIO = ['perfil', 'comprobante'];

module.exports = {
  logosPublicDir,
  aplicarCabecerasArchivoSubido,
  uploadLogoMemoria,
  TIPOS_LOGO_ASSET_AUTOSERVICIO,
};
