// Rutas de archivos subidos: logos en disco y logo_assets en BD.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate, requireModule } = require('../security/auth');
const { TIPOS_LOGO_ASSET_AUTOSERVICIO, aplicarCabecerasArchivoSubido, logosPublicDir, uploadLogoMemoria } = require('../lib/uploads');
const { pool } = require('../lib/db');

const router = express.Router();

const normalizarSlugLogo = (texto = '') => {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const storageLogo = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logosPublicDir),
  filename: (req, file, cb) => {
    const nombreBase = normalizarSlugLogo(`${req.body.tipo || 'logo'}-${req.body.nombre || 'sin-nombre'}`) || 'logo-sin-nombre';
    const extension = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${nombreBase}${extension}`);
  },
});

const uploadLogo = multer({
  storage: storageLogo,
  fileFilter: (_req, file, cb) => {
    const permitido = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!permitido.includes(file.mimetype)) {
      cb(new Error('Formato de logo no permitido. Usa PNG, JPG, WEBP o SVG.'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/api/assets/logos', authenticate, requireModule('admin_dashboard'), uploadLogo.single('archivo'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Debes seleccionar un archivo de logo.' });
    return;
  }

  res.json({
    nombre: req.body.nombre || '',
    tipo: req.body.tipo || 'logo',
    archivo: req.file.filename,
    url: `/logos/${req.file.filename}`,
  });
});

router.get('/api/assets/logos/list', (req, res) => {
  try {
    if (!fs.existsSync(logosPublicDir)) {
      return res.json({ logos: [] });
    }
    const files = fs.readdirSync(logosPublicDir)
      .filter((name) => /\.(png|jpg|jpeg|webp|svg)$/i.test(name))
      .map((name) => ({
        filename: name,
        url: `/logos/${name}`,
        nombre: name.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
      }));
    return res.json({ logos: files });
  } catch (error) {
    console.error('[GET /api/assets/logos/list]', error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/api/assets/logos/:filename', authenticate, requireModule('admin_dashboard'), (req, res) => {
  try {
    const rawFilename = decodeURIComponent(String(req.params.filename || '')).trim();
    const safeFilename = path.basename(rawFilename);

    if (!safeFilename || safeFilename !== rawFilename || !/\.(png|jpg|jpeg|webp|svg)$/i.test(safeFilename)) {
      res.status(400).json({ error: 'Nombre de archivo inválido para borrar logo.' });
      return;
    }

    const filePath = path.join(logosPublicDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'El logo indicado no existe en la carpeta de activos.' });
      return;
    }

    fs.unlinkSync(filePath);
    res.json({ ok: true, filename: safeFilename });
  } catch (error) {
    console.error('[DELETE /api/assets/logos/:filename]', error);
    res.status(500).json({ error: error.message || 'No se pudo borrar el logo.' });
  }
});
router.post('/api/logo-assets', authenticate, uploadLogoMemoria.single('archivo'), (req, res, next) => {
  const tipo = String(req.body.tipo || 'logo').trim() || 'logo';
  if (TIPOS_LOGO_ASSET_AUTOSERVICIO.includes(tipo)) {
    // El nombre lo fija el servidor a partir del actor autenticado, no el
    // valor que mande el cliente — si no, cualquiera podría forjar el
    // "nombre" y pisar la foto de perfil o el comprobante de OTRA persona
    // (el filename final sale de nombre+tipo y el INSERT hace upsert por
    // filename). El comprobante además lleva timestamp: cada envío es un
    // archivo nuevo, para no pisar el comprobante de un pago anterior
    // todavía en revisión.
    // El sufijo aleatorio (antes Date.now()) hace la URL del comprobante
    // imposible de adivinar: el archivo se sirve sin sesión (se usa en <img>).
    const rutActor = String(req.actor?.rut || 'sin-rut').trim();
    req.body.nombre = tipo === 'comprobante' ? `${rutActor}-${crypto.randomUUID()}` : rutActor;
    return next();
  }
  return requireModule('admin_dashboard')(req, res, next);
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar un archivo de logo.' });
    }

    const nombre = String(req.body.nombre || '').trim();
    const tipo = String(req.body.tipo || 'logo').trim() || 'logo';
    const extension = path.extname(req.file.originalname).toLowerCase() || '.png';
    const nombreBase = normalizarSlugLogo(`${tipo}-${nombre || 'sin-nombre'}`) || 'logo-sin-nombre';
    const filename = `${nombreBase}${extension}`;

    await pool.query(
      `INSERT INTO logo_assets (nombre, tipo, filename, mime_type, file_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (filename)
       DO UPDATE SET
         nombre = EXCLUDED.nombre,
         tipo = EXCLUDED.tipo,
         mime_type = EXCLUDED.mime_type,
         file_data = EXCLUDED.file_data,
         updated_at = NOW()`,
      [nombre, tipo, filename, req.file.mimetype || 'application/octet-stream', req.file.buffer]
    );

    // El espejo en disco (/logos, estático y listable por nombre) no aplica
    // a comprobantes: quedan solo en la BD, detrás de su nombre aleatorio.
    if (tipo !== 'comprobante') {
      try {
        fs.writeFileSync(path.join(logosPublicDir, filename), req.file.buffer);
      } catch {
        // El espejo en disco es opcional; la fuente principal queda en DB.
      }
    }

    return res.json({
      nombre,
      tipo,
      archivo: filename,
      filename,
      url: `/api/logo-assets/file/${encodeURIComponent(filename)}`,
      legacyUrl: `/logos/${filename}`,
    });
  } catch (error) {
    console.error('[POST /api/logo-assets]', error);
    return res.status(500).json({ error: error.message || 'No se pudo subir el logo.' });
  }
});

// Tipos que NO son logos de equipo/torneo pero comparten esta misma tabla
// (foto de perfil de onboarding, comprobante de pago, foto de jugador desde
// el panel admin o desde /api/jugadores/:rut/foto, foto de la tarjeta
// coleccionable desde /api/jugadores/:rut/foto-tarjeta) — se excluyen del
// listado para no entorpecer la búsqueda de logos reales.
const TIPOS_LOGO_ASSET_NO_LISTABLES = ['perfil', 'comprobante', 'jugador-foto', 'foto-jugador', 'foto-tarjeta-coleccion'];

router.get('/api/logo-assets/list', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT filename, nombre, tipo, created_at
       FROM logo_assets
       WHERE tipo IS NULL OR NOT (tipo = ANY($1::text[]))
       ORDER BY created_at DESC, filename ASC`,
      [TIPOS_LOGO_ASSET_NO_LISTABLES]
    );

    const logos = (result.rows || []).map((row) => ({
      filename: row.filename,
      nombre: row.nombre || String(row.filename || '').replace(/\.[^.]+$/, '').replace(/-/g, ' '),
      tipo: row.tipo || 'logo',
      url: `/api/logo-assets/file/${encodeURIComponent(row.filename)}`,
      legacyUrl: `/logos/${row.filename}`,
      created_at: row.created_at,
    }));

    return res.json({ logos });
  } catch (error) {
    console.error('[GET /api/logo-assets/list]', error);
    return res.status(500).json({ error: error.message || 'No se pudo listar los logos.' });
  }
});

router.get('/api/logo-assets/file/:filename', async (req, res) => {
  try {
    const rawFilename = decodeURIComponent(String(req.params.filename || '')).trim();
    const safeFilename = path.basename(rawFilename);
    if (!safeFilename || safeFilename !== rawFilename) {
      return res.status(400).json({ error: 'Nombre de archivo inválido.' });
    }

    const result = await pool.query(
      `SELECT mime_type, file_data FROM logo_assets WHERE filename = $1 LIMIT 1`,
      [safeFilename]
    );

    const row = result.rows?.[0];
    if (!row) {
      return res.status(404).json({ error: 'Logo no encontrado.' });
    }

    const esComprobante = safeFilename.startsWith('comprobante-');
    res.setHeader('Cache-Control', esComprobante ? 'private, max-age=86400' : 'public, max-age=604800');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    aplicarCabecerasArchivoSubido(res, row.mime_type);
    res.contentType(row.mime_type || 'application/octet-stream');
    return res.send(row.file_data);
  } catch (error) {
    console.error('[GET /api/logo-assets/file/:filename]', error);
    return res.status(500).json({ error: error.message || 'No se pudo obtener el logo.' });
  }
});

router.delete('/api/logo-assets/:filename', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const rawFilename = decodeURIComponent(String(req.params.filename || '')).trim();
    const safeFilename = path.basename(rawFilename);

    if (!safeFilename || safeFilename !== rawFilename || !/\.(png|jpg|jpeg|webp|svg)$/i.test(safeFilename)) {
      return res.status(400).json({ error: 'Nombre de archivo inválido para borrar logo.' });
    }

    const result = await pool.query(
      `DELETE FROM logo_assets WHERE filename = $1 RETURNING filename`,
      [safeFilename]
    );

    if ((result.rows || []).length === 0) {
      return res.status(404).json({ error: 'El logo indicado no existe.' });
    }

    try {
      const filePath = path.join(logosPublicDir, safeFilename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Sin efecto crítico: la fuente de verdad es DB.
    }

    return res.json({ ok: true, filename: safeFilename });
  } catch (error) {
    console.error('[DELETE /api/logo-assets/:filename]', error);
    return res.status(500).json({ error: error.message || 'No se pudo borrar el logo.' });
  }
});

module.exports = router;
