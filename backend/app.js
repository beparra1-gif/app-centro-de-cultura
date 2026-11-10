// Aplicación Express: middlewares globales (trust proxy, CORS, gzip, body parsers, auditoría/sync de mutaciones, /logos), montaje de routers y manejador de errores.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { normalizeEnvValue } = require('./lib/util');
const { MUTATING_METHODS, getTableFromApiRequest, obtenerActorRequest, registrarAuditoriaCambio, sanitizarBodyParaRegistro } = require('./lib/auditoria');
const { pool, sheetsSyncManager, sheetsWebhookSyncManager } = require('./lib/db');
const { aplicarCabecerasArchivoSubido, logosPublicDir } = require('./lib/uploads');

const app = express();

// ========== MIDDLEWARE ==========
// DigitalOcean App Platform pone un proxy delante: sin esto req.ip es la IP
// del proxy para TODOS los usuarios y el rate limit de login (por IP) se
// volvía global para el club entero. 1 = confiar solo en el salto inmediato
// (el balanceador), no en cadenas X-Forwarded-For arbitrarias del cliente.
// Configurable con TRUST_PROXY (ej. 0 para desactivarlo en local).
const trustProxyEnv = String(process.env.TRUST_PROXY ?? '').trim();
app.set('trust proxy', trustProxyEnv === '' ? 1 : (Number.isFinite(Number(trustProxyEnv)) ? Number(trustProxyEnv) : trustProxyEnv));

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const configuredFrontendUrl = normalizeEnvValue(process.env.FRONTEND_URL || '');
const allowedOrigins = new Set([...DEV_ORIGINS, ...(configuredFrontendUrl ? [configuredFrontendUrl] : [])]);

app.use(cors({
  origin: (origin, callback) => {
    // Sin header Origin (curl, health checks del propio server) o allowlisted: permitir.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS.'));
  },
  credentials: false,
  // Lo lee src/api/client.js para cerrar sesión cuando la cuenta debe
  // cambiar su clave (ver authenticate en security/auth.js).
  exposedHeaders: ['X-Requiere-Cambio-Clave'],
}));
// gzip de todas las respuestas (JSON sobre todo): el arranque de un admin
// bajaba ~765 KB sin comprimir (pagos 412 KB, jugadores 143 KB) y se repetía
// en el poll de 20 s. Con gzip el JSON queda en ~10-15% del tamaño.
app.use(compression());

// 15mb: /api/pagos* acepta comprobantes de pago como base64 en el body JSON
// (PagoForm.jsx no comprime ni limita el archivo antes de enviarlo).
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

app.use((req, res, next) => {
  const shouldTrack = MUTATING_METHODS.has(String(req.method || '').toUpperCase());
  if (!shouldTrack) {
    next();
    return;
  }

  const tableName = getTableFromApiRequest(req);
  if (!tableName) {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    void (async () => {
      const actor = obtenerActorRequest(req);
      await registrarAuditoriaCambio(pool, req, tableName);
      sheetsSyncManager.enqueueTable(tableName);
      sheetsSyncManager.enqueueTable('auditoria');
      sheetsWebhookSyncManager.enqueueEvent({
        table: tableName,
        action: String(req.method || '').toUpperCase(),
        path: req.path,
        params: req.params || {},
        body: sanitizarBodyParaRegistro(req.body),
        actor: {
          id: actor.id || null,
          rut: actor.rut || null,
          rol: actor.rol || null,
        },
        statusCode: res.statusCode,
        occurredAt: new Date().toISOString(),
      });
    })();
  });

  next();
});

app.use('/logos', express.static(logosPublicDir, {
  fallthrough: true,
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    aplicarCabecerasArchivoSubido(res, path.extname(filePath).toLowerCase() === '.svg' ? 'image/svg+xml' : '');
  },
}));

// ==========================================
// RUTAS
// ==========================================
// Cada router declara sus rutas con el path completo (/api/...), así que se
// montan sin prefijo. El orden replica el orden en que aparecían las rutas en
// el server.js original (no hay rutas de distintos routers que se pisen).
app.use(require('./routes/assets'));
app.use(require('./routes/comunicaciones'));
app.use(require('./routes/admin'));
app.use(require('./routes/auth'));
app.use(require('./routes/pagos'));
app.use(require('./routes/cuentas'));
app.use(require('./routes/jugadores'));
app.use(require('./routes/citaciones'));
app.use(require('./routes/torneos'));
app.use(require('./routes/kiosco'));
app.use(require('./routes/cancha'));

// Crons que se registran al cargar la app (el de sincronización desde Google
// Sheets vive en routes/admin.js porque comparte estado con sus rutas).
require('./lib/tareasProgramadas');

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;

