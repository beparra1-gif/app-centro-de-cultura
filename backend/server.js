const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const multer = require('multer');
require('dotenv').config();
const cron = require('node-cron');
const { runImportFromSheets } = require('./import-google-sheets');
const { createSheetsSyncManager } = require('./google-sheets-sync');
const { createSheetsWebhookSyncManager } = require('./google-sheets-webhook-sync');
const rateLimit = require('express-rate-limit');
const {
  hashPassword,
  verifyPassword,
  signToken,
  authenticate,
  requireRole,
  requireModule,
  requireAnyModule,
  requireOwnerIdOrModule,
  stripFieldsUnlessModule,
} = require('./security/auth');

const app = express();
let isSheetsSyncRunning = false;
let lastSheetsSyncStatus = null;
let isBackupRunning = false;
let lastBackupRunStatus = null;
let backupCronTask = null;
const execFileAsync = promisify(execFile);

const normalizeEnvValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const unquoted = raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
  return unquoted;
};

const serializeError = (error) => {
  const e = error || {};
  const meta = e.$metadata || {};
  return {
    name: e.name || null,
    message: e.message || String(e),
    code: e.code || e.Code || null,
    statusCode: e.statusCode || meta.httpStatusCode || null,
    requestId: e.requestId || meta.requestId || null,
    extendedRequestId: meta.extendedRequestId || null,
  };
};

const resolveRuntimePath = (rawPath = '') => {
  const cleaned = String(rawPath || '').trim();
  if (!cleaned) return '';
  if (path.isAbsolute(cleaned)) return cleaned;

  const fromCwd = path.resolve(cleaned);
  if (fs.existsSync(fromCwd)) return fromCwd;

  return path.resolve(__dirname, cleaned);
};

const getBackupConfig = () => {
  const backupDir = resolveRuntimePath(String(process.env.BACKUP_DIR || 'backups'));
  const manifestPath = resolveRuntimePath(String(process.env.BACKUP_MANIFEST_PATH || path.join(backupDir, 'backup-manifest.json')));
  const cronExpr = String(process.env.BACKUP_CRON || '0 */6 * * *').trim();
  const keepDays = Number(process.env.BACKUP_KEEP_DAYS || 7);
  const keepMaxFiles = Number(process.env.BACKUP_KEEP_MAX_FILES || 48);
  const runOnStart = String(process.env.BACKUP_RUN_ON_START || 'true').toLowerCase() === 'true';
  const enabled = String(process.env.BACKUP_ENABLED || 'true').toLowerCase() === 'true';
  const allowJsonFallback = String(process.env.BACKUP_ALLOW_JSON_FALLBACK || 'true').toLowerCase() === 'true';

  return {
    enabled,
    backupDir,
    manifestPath,
    cronExpr,
    keepDays: Number.isFinite(keepDays) && keepDays > 0 ? keepDays : 7,
    keepMaxFiles: Number.isFinite(keepMaxFiles) && keepMaxFiles > 0 ? keepMaxFiles : 48,
    runOnStart,
    allowJsonFallback,
  };
};

const getBackupStorageConfig = () => {
  const uploadEnabled = String(process.env.BACKUP_UPLOAD_ENABLED || 'false').toLowerCase() === 'true';
  const uploadRequired = String(process.env.BACKUP_UPLOAD_REQUIRED || 'false').toLowerCase() === 'true';
  const endpoint = normalizeEnvValue(process.env.BACKUP_S3_ENDPOINT || '');
  const region = normalizeEnvValue(process.env.BACKUP_S3_REGION || 'us-east-1');
  const bucket = normalizeEnvValue(process.env.BACKUP_S3_BUCKET || '');
  const accessKeyId = normalizeEnvValue(process.env.BACKUP_S3_ACCESS_KEY_ID || '');
  const secretAccessKey = normalizeEnvValue(process.env.BACKUP_S3_SECRET_ACCESS_KEY || '');
  const prefixRaw = normalizeEnvValue(process.env.BACKUP_S3_PREFIX || 'ccf-db-backups');
  const prefix = prefixRaw.replace(/^\/+/, '').replace(/\/+$/, '');

  const hasCredentials = Boolean(accessKeyId && secretAccessKey);
  const hasCoreConfig = Boolean(endpoint && bucket && hasCredentials);
  const missingFields = [];
  if (!endpoint) missingFields.push('BACKUP_S3_ENDPOINT');
  if (!bucket) missingFields.push('BACKUP_S3_BUCKET');
  if (!accessKeyId) missingFields.push('BACKUP_S3_ACCESS_KEY_ID');
  if (!secretAccessKey) missingFields.push('BACKUP_S3_SECRET_ACCESS_KEY');

  const accessKeyFingerprint = accessKeyId
    ? `${accessKeyId.slice(0, 4)}...${accessKeyId.slice(-4)}`
    : null;

  return {
    uploadEnabled,
    uploadRequired,
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix,
    hasCoreConfig,
    missingFields,
    accessKeyFingerprint,
  };
};

const uploadBackupToObjectStorage = async ({ localFilePath, trigger, strategy }) => {
  const storage = getBackupStorageConfig();
  if (!storage.uploadEnabled) {
    return { attempted: false, uploaded: false, skipped: true, reason: 'BACKUP_UPLOAD_ENABLED=false' };
  }

  if (!storage.hasCoreConfig) {
    const reason = `Configuración S3 incompleta (${storage.missingFields.join(', ') || 'endpoint/bucket/credenciales'}).`;
    if (storage.uploadRequired) {
      throw new Error(reason);
    }
    return { attempted: true, uploaded: false, skipped: true, reason };
  }

  const s3 = new S3Client({
    region: storage.region,
    endpoint: storage.endpoint,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
    forcePathStyle: true,
  });

  const fileName = path.basename(localFilePath);
  const objectKey = `${storage.prefix}/${new Date().toISOString().slice(0, 10)}/${fileName}`;
  const fileBuffer = fs.readFileSync(localFilePath);
  const contentType = strategy === 'json_fallback' ? 'application/json' : 'application/sql';

  await s3.send(new PutObjectCommand({
    Bucket: storage.bucket,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: contentType,
    Metadata: {
      trigger,
      strategy,
      generated_at: new Date().toISOString(),
    },
  }));

  const headRes = await s3.send(new HeadObjectCommand({
    Bucket: storage.bucket,
    Key: objectKey,
  }));

  return {
    attempted: true,
    uploaded: true,
    bucket: storage.bucket,
    endpoint: storage.endpoint,
    region: storage.region,
    objectKey,
    etag: headRes.ETag || null,
    remoteSizeBytes: Number(headRes.ContentLength || 0),
    verifiedAt: new Date().toISOString(),
  };
};

const writeBackupManifest = ({ manifestPath, payload }) => {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const cleanupOldBackups = ({ backupDir, manifestPath, keepDays, keepMaxFiles }) => {
  if (!fs.existsSync(backupDir)) {
    return { totalRemoved: 0, removedByAge: 0, removedByCount: 0 };
  }

  const thresholdMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const manifestName = path.basename(manifestPath || '');
  let removedByAge = 0;
  let removedByCount = 0;
  const retainedFiles = [];

  for (const name of fs.readdirSync(backupDir)) {
    const fullPath = path.join(backupDir, name);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      if (!/\.(sql|dump|backup|bak|gz|json)$/i.test(name)) continue;
      if (manifestName && name === manifestName) continue;
      if (stat.mtimeMs < thresholdMs) {
        fs.unlinkSync(fullPath);
        removedByAge += 1;
        continue;
      }

      retainedFiles.push({ fullPath, stat });
    } catch {
      // Ignorar archivos bloqueados o removidos concurrentemente.
    }
  }

  if (keepMaxFiles > 0 && retainedFiles.length > keepMaxFiles) {
    retainedFiles
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(keepMaxFiles)
      .forEach(({ fullPath }) => {
        try {
          fs.unlinkSync(fullPath);
          removedByCount += 1;
        } catch {
          // Ignorar archivos bloqueados o removidos concurrentemente.
        }
      });
  }

  return {
    totalRemoved: removedByAge + removedByCount,
    removedByAge,
    removedByCount,
  };
};

const runPgDumpBackup = async ({ databaseUrl, outputFile }) => {
  const args = [
    '--no-owner',
    '--no-privileges',
    '--format=plain',
    '--file',
    outputFile,
    databaseUrl,
  ];

  await execFileAsync('pg_dump', args, {
    env: {
      ...process.env,
      PGSSLMODE: process.env.PGSSLMODE || 'prefer',
    },
    windowsHide: true,
  });
};

const runJsonBackupFallback = async ({ outputFile }) => {
  const tablesRes = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name ASC`
  );

  const backupPayload = {
    generatedAt: new Date().toISOString(),
    strategy: 'json_fallback',
    tables: {},
  };

  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) continue;
    const tableData = await pool.query(`SELECT * FROM ${tableName}`);
    backupPayload.tables[tableName] = tableData.rows;
  }

  fs.writeFileSync(outputFile, `${JSON.stringify(backupPayload)}\n`, 'utf8');
};

const runDatabaseBackup = async ({ trigger = 'manual' } = {}) => {
  const cfg = getBackupConfig();
  if (!cfg.enabled) {
    return { ok: false, skipped: true, reason: 'BACKUP_ENABLED=false' };
  }

  if (isBackupRunning) {
    return { ok: false, skipped: true, reason: 'Ya hay un backup en ejecución' };
  }

  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    return { ok: false, skipped: true, reason: 'DATABASE_URL no configurada' };
  }

  isBackupRunning = true;
  const startedAt = new Date().toISOString();

  try {
    fs.mkdirSync(cfg.backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
    const sqlFileName = `ccf_backup_${stamp}.sql`;
    const jsonFileName = `ccf_backup_${stamp}.json`;
    const sqlOutput = path.join(cfg.backupDir, sqlFileName);
    const jsonOutput = path.join(cfg.backupDir, jsonFileName);

    let strategy = 'pg_dump';
    let outputPath = sqlOutput;

    try {
      await runPgDumpBackup({ databaseUrl, outputFile: sqlOutput });
    } catch (error) {
      const msg = String(error.message || '').toLowerCase();
      const isCommandMissing = String(error.code || '').toUpperCase() === 'ENOENT' || msg.includes('not recognized');
      const isVersionMismatch = msg.includes('server version mismatch') || msg.includes('pg_dump version');
      if (!cfg.allowJsonFallback || (!isCommandMissing && !isVersionMismatch)) {
        throw error;
      }

      strategy = 'json_fallback';
      outputPath = jsonOutput;
      await runJsonBackupFallback({ outputFile: jsonOutput });
    }

    const stat = fs.statSync(outputPath);
    const removedFiles = cleanupOldBackups({
      backupDir: cfg.backupDir,
      manifestPath: cfg.manifestPath,
      keepDays: cfg.keepDays,
      keepMaxFiles: cfg.keepMaxFiles,
    });
    let upload = null;

    try {
      upload = await uploadBackupToObjectStorage({
        localFilePath: outputPath,
        trigger,
        strategy,
      });
    } catch (uploadError) {
      const storageCfg = getBackupStorageConfig();
      if (storageCfg.uploadRequired) {
        throw uploadError;
      }
      upload = {
        attempted: true,
        uploaded: false,
        skipped: true,
        reason: uploadError.message,
      };
    }

    const manifestPayload = {
      lastSuccessAt: new Date().toISOString(),
      latestBackupAt: new Date().toISOString(),
      filePath: outputPath,
      strategy,
      trigger,
      sizeBytes: stat.size,
      keepDays: cfg.keepDays,
      keepMaxFiles: cfg.keepMaxFiles,
      cleanedOldFiles: removedFiles.totalRemoved,
      cleanedOldFilesByAge: removedFiles.removedByAge,
      cleanedOldFilesByCount: removedFiles.removedByCount,
      upload,
      status: 'ok',
    };

    writeBackupManifest({ manifestPath: cfg.manifestPath, payload: manifestPayload });
    lastBackupRunStatus = {
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      detail: manifestPayload,
    };

    return { ok: true, ...manifestPayload };
  } catch (error) {
    const errorDetail = serializeError(error);
    const storageCfg = getBackupStorageConfig();
    const failurePayload = {
      status: 'error',
      failedAt: new Date().toISOString(),
      trigger,
      message: errorDetail.message,
      detail: errorDetail,
      storage: {
        uploadEnabled: storageCfg.uploadEnabled,
        endpoint: storageCfg.endpoint || null,
        bucket: storageCfg.bucket || null,
        region: storageCfg.region || null,
        accessKeyFingerprint: storageCfg.accessKeyFingerprint,
        missingFields: storageCfg.missingFields,
      },
    };
    try {
      writeBackupManifest({ manifestPath: cfg.manifestPath, payload: failurePayload });
    } catch {
      // Si no puede escribir manifest, de todas formas devolvemos error.
    }

    lastBackupRunStatus = {
      status: 'error',
      startedAt,
      finishedAt: new Date().toISOString(),
      error: errorDetail.message,
      detail: errorDetail,
    };

    return {
      ok: false,
      error: errorDetail.message,
      detail: errorDetail,
      storage: failurePayload.storage,
    };
  } finally {
    isBackupRunning = false;
  }
};

const scheduleAutomaticBackups = () => {
  const cfg = getBackupConfig();
  if (!cfg.enabled) {
    console.log('[BACKUP] Automatización deshabilitada (BACKUP_ENABLED=false).');
    return;
  }

  if (!cron.validate(cfg.cronExpr)) {
    console.error(`[BACKUP] Expresión cron inválida: ${cfg.cronExpr}`);
    return;
  }

  if (backupCronTask) {
    try {
      backupCronTask.stop();
      backupCronTask.destroy();
    } catch {
      // Ignorar reinicios de task.
    }
  }

  backupCronTask = cron.schedule(cfg.cronExpr, async () => {
    const result = await runDatabaseBackup({ trigger: 'cron' });
    if (result.ok) {
      console.log(`[BACKUP] OK (${result.strategy}) -> ${result.filePath}`);
    } else if (!result.skipped) {
      console.error(`[BACKUP] ERROR: ${result.error || result.reason || 'fallo desconocido'}`);
    }
  });

  console.log(`[BACKUP] Programado con cron '${cfg.cronExpr}' (retención ${cfg.keepDays} días, máximo ${cfg.keepMaxFiles} archivos).`);

  if (cfg.runOnStart) {
    runDatabaseBackup({ trigger: 'startup' })
      .then((result) => {
        if (result.ok) {
          console.log(`[BACKUP] Inicio OK (${result.strategy}) -> ${result.filePath}`);
          return;
        }
        if (!result.skipped) {
          console.error(`[BACKUP] Inicio con error: ${result.error || result.reason || 'fallo desconocido'}`);
        }
      })
      .catch((error) => {
        console.error(`[BACKUP] Inicio con excepción: ${error.message}`);
      });
  }
};

const getSyncTokenFromRequest = (req) => {
  const headerToken = req.headers['x-sync-token'];
  if (headerToken) return String(headerToken).trim();

  const authHeader = String(req.headers.authorization || '');
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
};

const RESOURCE_TABLE_MAP = {
  cuentas: 'cuentas',
  jugadores: 'jugadores',
  'jugadores-visita': 'jugadores_visita',
  usuarios: 'cuentas',
  encuestas: 'encuestas',
  comunicaciones: 'comunicaciones',
  comentarios: 'comentarios',
  convocatorias: 'convocatorias',
  eventos: 'eventos',
  asistencia: 'asistencia',
  pagos: 'pagos',
  'pagos-mensualidades': 'pagos_mensualidades',
  alertas: 'alertas',
  estadisticas: 'estadisticas',
  marcas: 'marcas_tiempo',
  evaluaciones: 'evaluaciones',
  gamificacion: 'gamificacion_puntos',
  quiz: 'quiz_preguntas',
  pizarra: 'pizarra_tactica',
  resultados: 'resultados',
  'partidos-live': 'partidos_live',
  'asistencia-eventos': 'asistencia_eventos',
  staff: 'staff',
  torneos: 'torneos',
  kiosco: 'caja_evento_kiosco',
  'caja-evento': 'caja_evento_kiosco',
  inventario: 'catalogo_inventario',
  egresos: 'egresos',
  'kiosco-productos': 'kiosco_productos',
  'kiosco-turnos': 'kiosco_turnos',
  'kiosco-ventas': 'kiosco_ventas',
  'kiosco-fiados': 'kiosco_fiados',
  'kiosco-egresos': 'kiosco_egresos',
  clubes: 'clubes',
  lesiones: 'lesiones',
  disciplina: 'disciplina',
  entrenamientos: 'entrenamientos',
};

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const normalizarRolSistema = (rol = '') => {
  const raw = String(rol || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'superadmin') return 'super_admin';
  return raw;
};

// Preferir el actor verificado por JWT (req.actor, seteado por el middleware
// authenticate); los headers x-user-* solo quedan como respaldo informativo
// para trazabilidad en rutas sin sesión (no deben usarse para autorizar).
const obtenerActorRequest = (req) => {
  if (req.actor) {
    return {
      id: req.actor.id == null ? null : String(req.actor.id).trim(),
      rut: normalizarRut(String(req.actor.rut || '')),
      rol: req.actor.rol,
    };
  }

  const idHeader = req.headers['x-user-id'];
  const rutHeader = req.headers['x-user-rut'];
  const rolHeader = req.headers['x-user-role'];

  return {
    id: idHeader == null ? null : String(idHeader).trim(),
    rut: normalizarRut(String(rutHeader || '')),
    rol: normalizarRolSistema(rolHeader),
  };
};

const quoteIdent = (ident = '') => `"${String(ident || '').replace(/"/g, '""')}"`;

const getTableFromApiRequest = (req) => {
  const pathParts = String(req.path || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  if (pathParts[0] !== 'api') return '';
  const resource = String(pathParts[1] || '').toLowerCase();
  if (!resource || resource === 'admin' || resource === 'auth') return '';

  // /api/encuestas/:encuestaId/respuesta writes to encuestas_respuestas.
  if (resource === 'encuestas' && String(pathParts[3] || '').toLowerCase() === 'respuesta') {
    return 'encuestas_respuestas';
  }

  return RESOURCE_TABLE_MAP[resource] || '';
};

const registrarAuditoriaCambio = async (poolRef, req, tableName) => {
  if (!tableName) return;

  try {
    const actor = obtenerActorRequest(req);
    const registroRaw = req.params?.id || req.params?.rut || req.params?.id_partido || null;
    const registroNumerico = Number.parseInt(String(registroRaw || ''), 10);
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const cambios = Object.fromEntries(Object.entries(payload).slice(0, 40));

    await poolRef.query(
      `INSERT INTO auditoria (
        usuario_id,
        tabla_afectada,
        tipo_accion,
        registro_id,
        valores_nuevos,
        descripcion,
        ip_usuario
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        Number.isFinite(Number(actor.id)) ? Number(actor.id) : null,
        tableName,
        String(req.method || '').toUpperCase(),
        Number.isFinite(registroNumerico) ? registroNumerico : null,
        JSON.stringify({
          params: req.params || {},
          changes: cambios,
          actor: {
            id: actor.id || null,
            rut: actor.rut || null,
            rol: actor.rol || null,
          },
        }),
        `Cambio ${String(req.method || '').toUpperCase()} en ${tableName}`,
        req.ip || null,
      ]
    );
  } catch (error) {
    console.error(`[AUDITORIA] No se pudo registrar cambio en ${tableName}: ${error.message}`);
  }
};

const normalizarEstadoPagoMensualidad = (estado) => {
  const raw = String(estado || '').trim().toLowerCase();
  if (['aprobado', 'aprobada', 'pagado', 'pagada', 'ok', 'completado', 'completada'].includes(raw)) {
    return 'aprobado';
  }
  if (['rechazado', 'rechazada', 'fallido', 'fallida', 'anulado', 'anulada'].includes(raw)) {
    return 'rechazado';
  }
  return 'pendiente';
};

// ========== MIDDLEWARE ==========
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
  credentials: false
}));
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
        body: req.body && typeof req.body === 'object' ? req.body : {},
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

const normalizarSlugLogo = (texto = '') => {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const logosPublicDir = path.join(__dirname, '..', 'public', 'logos');
fs.mkdirSync(logosPublicDir, { recursive: true });

app.use('/logos', express.static(logosPublicDir, {
  fallthrough: true,
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

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

const uploadLogoMemoria = multer({
  storage: multer.memoryStorage(),
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

app.post('/api/assets/logos', authenticate, requireModule('admin_dashboard'), uploadLogo.single('archivo'), (req, res) => {
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

app.get('/api/assets/logos/list', (req, res) => {
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
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/assets/logos/:filename', authenticate, requireModule('admin_dashboard'), (req, res) => {
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
    res.status(500).json({ error: error.message || 'No se pudo borrar el logo.' });
  }
});

// ========== DATABASE POOL ==========
const rawDatabaseUrl = String(process.env.DATABASE_URL || '');
const safeDatabaseUrl = rawDatabaseUrl.includes('sslmode=require')
  ? rawDatabaseUrl.replace('sslmode=require', 'sslmode=no-verify')
  : rawDatabaseUrl;

const shouldUseSsl =
  String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
  rawDatabaseUrl.includes('ondigitalocean.com') ||
  rawDatabaseUrl.includes('sslmode=require') ||
  rawDatabaseUrl.includes('sslmode=no-verify');

const pool = new Pool({
  connectionString: safeDatabaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Error en pool:', err);
});

const sheetsSyncManager = createSheetsSyncManager({
  pool,
  logger: console,
});

const sheetsWebhookSyncManager = createSheetsWebhookSyncManager({
  logger: console,
});

const normalizarRut = (rut = '') => {
  return String(rut).replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
};

const validarRutChileno = (rut = '') => {
  const limpio = normalizarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);

  return dv === dvEsperado;
};

const formatearRut = (rut = '') => {
  const limpio = normalizarRut(rut);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo}-${dv}`;
};

const omitPassword = (cuenta = {}) => {
  const resto = { ...cuenta };
  delete resto.password;
  return resto;
};

const construirCorreoPlaceholderDesdeRut = (rutNormalizado = '') => {
  const limpio = String(rutNormalizado || '').trim().toLowerCase();
  return `${limpio || 'sin-rut'}@actualizar.local`;
};

const obtenerCuentaPorRutNormalizado = async (rutNormalizado) => {
  const columnasCuentas = await obtenerColumnasTabla('cuentas');
  const col = (nombre, castSql = 'text') => (
    columnasCuentas.has(nombre)
      ? nombre
      : `NULL::${castSql} AS ${nombre}`
  );

  const result = await pool.query(
    `SELECT
      ${col('id', 'int')},
      ${col('correo')},
      ${col('rut')},
      ${col('password')},
      ${col('nombres')},
      ${col('apellido_paterno')},
      ${col('rol')},
      ${col('perfil_principal')},
      ${col('estado')},
      ${col('forzar_clave', 'boolean')},
      ${col('foto_perfil_url')},
      ${col('requiere_foto_perfil', 'boolean')}
     FROM cuentas
     WHERE UPPER(REPLACE(REPLACE(COALESCE(rut, ''), '.', ''), '-', '')) = $1
     LIMIT 1`,
    [rutNormalizado]
  );

  return result.rows[0] || null;
};

const provisionarCuentaJugadorSiCorresponde = async ({ rutNormalizado, password }) => {
  if (String(password || '') !== '12345') return null;
  const passwordHashDefault = await hashPassword('12345');

  const jugadorRes = await pool.query(
    `SELECT rut_jugador, nombres, apellido_paterno, estado
     FROM jugadores
     WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1
     LIMIT 1`,
    [rutNormalizado]
  );

  if (jugadorRes.rows.length === 0) return null;

  const jugador = jugadorRes.rows[0];
  const estadoJugador = String(jugador.estado || 'ACTIVO').toUpperCase();
  if (estadoJugador === 'BAJA') return null;

  const rutFormateado = formatearRut(jugador.rut_jugador || rutNormalizado);
  const correoPlaceholder = construirCorreoPlaceholderDesdeRut(rutNormalizado);

  const columnasCuentas = await obtenerColumnasTabla('cuentas');
  const requiereFotoExiste = columnasCuentas.has('requiere_foto_perfil');

  const existente = await obtenerCuentaPorRutNormalizado(rutNormalizado);
  if (existente?.id) {
    await pool.query(
      `UPDATE cuentas
       SET nombres = COALESCE(NULLIF(nombres, ''), $1),
           apellido_paterno = COALESCE(NULLIF(apellido_paterno, ''), $2),
           rol = COALESCE(rol, 'jugador'),
           perfil_principal = COALESCE(perfil_principal, 'jugador'),
           estado = COALESCE(estado, 'activo'),
           password = CASE WHEN COALESCE(NULLIF(password, ''), '') = '' THEN $4 ELSE password END,
           forzar_clave = CASE WHEN COALESCE(NULLIF(password, ''), '') = '' THEN true ELSE COALESCE(forzar_clave, false) END,
           updated_at = NOW()
       WHERE id = $3`,
      [jugador.nombres || null, jugador.apellido_paterno || null, existente.id, passwordHashDefault]
    );
    return await obtenerCuentaPorRutNormalizado(rutNormalizado);
  }

  if (requiereFotoExiste) {
    await pool.query(
      `INSERT INTO cuentas (
        correo, rut, password, nombres, apellido_paterno, rol, perfil_principal, estado, forzar_clave, requiere_foto_perfil
      ) VALUES (
        $1, $2, $3, $4, $5, 'jugador', 'jugador', 'activo', true, false
      )`,
      [correoPlaceholder, rutFormateado, passwordHashDefault, jugador.nombres || null, jugador.apellido_paterno || null]
    );
  } else {
    await pool.query(
      `INSERT INTO cuentas (
        correo, rut, password, nombres, apellido_paterno, rol, perfil_principal, estado, forzar_clave
      ) VALUES (
        $1, $2, $3, $4, $5, 'jugador', 'jugador', 'activo', true
      )`,
      [correoPlaceholder, rutFormateado, passwordHashDefault, jugador.nombres || null, jugador.apellido_paterno || null]
    );
  }

  return await obtenerCuentaPorRutNormalizado(rutNormalizado);
};

const columnasTablaCache = new Map();

const obtenerColumnasTabla = async (tabla) => {
  if (columnasTablaCache.has(tabla)) {
    return columnasTablaCache.get(tabla);
  }

  const resultado = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tabla]
  );

  const columnas = new Set(resultado.rows.map((fila) => fila.column_name));
  columnasTablaCache.set(tabla, columnas);
  return columnas;
};

const camposObligatoriosCuenta = [
  'correo',
  'rut',
  'nombres',
  'apellido_paterno',
  'telefono',
  'direccion',
  'comuna',
  'rol'
];

const detectarCamposFaltantesCuenta = (cuenta) => {
  const faltantes = [];
  for (const campo of camposObligatoriosCuenta) {
    const valor = cuenta[campo];
    if (valor == null || String(valor).trim() === '') {
      faltantes.push(campo);
    }
  }

  const correo = String(cuenta.correo || '').toLowerCase();
  if (correo.endsWith('@actualizar.local')) {
    faltantes.push('correo');
  }

  const rut = String(cuenta.rut || '').toUpperCase();
  if (rut.startsWith('PENDIENTE-RUT-')) {
    faltantes.push('rut');
  }

  if (cuenta.rut && !validarRutChileno(cuenta.rut)) {
    faltantes.push('rut_valido');
  }

  return faltantes;
};

const extractSheetId = (input = '') => {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
};

const normalizarRutComparacion = (rut = '') => {
  return String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
};

const obtenerConflictosRutJugadoresSheet = async () => {
  const sheetId = extractSheetId(process.env.GOOGLE_SHEET_ID || '');
  if (!sheetId) {
    throw new Error('Falta GOOGLE_SHEET_ID para auditar conflictos de RUT en jugadores.');
  }

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('JUGADORES')}`;
  const response = await axios.get(url, { timeout: 30000 });
  const rows = parse(response.data, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
  });

  const grupos = new Map();
  rows.forEach((row, index) => {
    const rutRaw = row.rut_jugador || row.RUT_JUGADOR || '';
    const rutNormalizado = normalizarRutComparacion(rutRaw);
    if (!rutNormalizado) return;

    if (!grupos.has(rutNormalizado)) {
      grupos.set(rutNormalizado, {
        rut: String(rutRaw || '').trim(),
        rutNormalizado,
        totalFilas: 0,
        filas: [],
      });
    }

    const grupo = grupos.get(rutNormalizado);
    grupo.totalFilas += 1;
    grupo.filas.push({
      filaSheet: index + 2,
      rut_jugador: String(rutRaw || '').trim(),
      nombres: String(row.nombres || row.NOMBRES || '').trim(),
      apellido_paterno: String(row.apellido_paterno || row.APELLIDO_PATERNO || '').trim(),
      apellido_materno: String(row.apellido_materno || row.APELLIDO_MATERNO || '').trim(),
      correo_apoderado: String(row.correo_apoderado || row.CORREO_APODERADO || '').trim(),
      rama: String(row.rama || row.RAMA || '').trim(),
      categoria: String(row.categoria || row.CATEGORIA || '').trim(),
      estado: String(row.estado || row.ESTADO || '').trim(),
    });
  });

  const conflictos = [];
  const rutsConflicto = [...grupos.entries()]
    .filter(([, grupo]) => grupo.totalFilas > 1)
    .map(([rut]) => rut);

  for (const rutNormalizado of rutsConflicto) {
    const grupo = grupos.get(rutNormalizado);
    const jugadorDbRes = await pool.query(
      `SELECT rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, correo_apoderado, estado, updated_at
       FROM jugadores
       WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1
       LIMIT 1`,
      [rutNormalizado]
    );

    const jugadorActual = jugadorDbRes.rows[0] || null;
    conflictos.push({
      rut: grupo.rut,
      rutNormalizado: grupo.rutNormalizado,
      totalFilas: grupo.totalFilas,
      jugadorActual,
      filas: grupo.filas,
    });
  }

  return {
    sheetId,
    totalFilas: rows.length,
    totalConflictos: conflictos.length,
    conflictos,
  };
};

const obtenerResumenCalidadDatos = async () => {
  const jugadoresMissingRes = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM jugadores
     WHERE COALESCE(TRIM(nombres), '') = ''
        OR COALESCE(TRIM(rut_jugador), '') = ''
        OR COALESCE(TRIM(rama), '') = ''
        OR COALESCE(TRIM(categoria), '') = ''`
  );

  const jugadoresRutFormatoRes = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM jugadores
     WHERE COALESCE(rut_jugador, '') <> ''
       AND NOT (UPPER(REPLACE(REPLACE(rut_jugador, '.', ''), '-', '')) ~ '^[0-9]{7,8}[0-9K]$')`
  );

  const jugadoresSinCuentaRes = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM jugadores j
     LEFT JOIN cuentas c ON LOWER(COALESCE(j.correo_apoderado, '')) = LOWER(COALESCE(c.correo, ''))
     WHERE COALESCE(TRIM(j.correo_apoderado), '') <> ''
       AND c.id IS NULL`
  );

  const pagosSinRutRes = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM pagos_mensualidades
     WHERE COALESCE(TRIM(rut_jugador), '') = ''
       AND COALESCE(TRIM(rut_pagos), '') = ''`
  );

  const pagosSinMesesRes = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM pagos_mensualidades
     WHERE COALESCE(TRIM(meses_correspondientes), '') = ''`
  );

  return {
    jugadores: {
      faltantesClave: jugadoresMissingRes.rows[0]?.total || 0,
      rutFormatoInvalido: jugadoresRutFormatoRes.rows[0]?.total || 0,
      correoApoderadoSinCuenta: jugadoresSinCuentaRes.rows[0]?.total || 0,
    },
    pagosMensualidades: {
      sinRutJugador: pagosSinRutRes.rows[0]?.total || 0,
      sinMeses: pagosSinMesesRes.rows[0]?.total || 0,
    },
  };
};

const obtenerDetalleCalidadDatos = async () => {
  const cuentasRes = await pool.query(
    `SELECT *
     FROM cuentas
     ORDER BY updated_at DESC`
  );

  const cuentasIncompletas = cuentasRes.rows
    .map((cuenta) => {
      const camposFaltantes = detectarCamposFaltantesCuenta(cuenta);
      return {
        id: cuenta.id,
        correo: cuenta.correo || '',
        rut: cuenta.rut ? formatearRut(cuenta.rut) : '',
        nombres: cuenta.nombres || '',
        apellido_paterno: cuenta.apellido_paterno || '',
        rol: cuenta.rol || '',
        campos_faltantes: camposFaltantes,
        updated_at: cuenta.updated_at,
      };
    })
    .filter((cuenta) => cuenta.campos_faltantes.length > 0);

  const jugadoresIncompletosCountRes = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM jugadores
     WHERE COALESCE(TRIM(nombres), '') = ''
        OR COALESCE(TRIM(rut_jugador), '') = ''
        OR COALESCE(TRIM(rama), '') = ''
        OR COALESCE(TRIM(categoria), '') = ''
        OR NOT (UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) ~ '^[0-9]{7,8}[0-9K]$')`
  );

  const jugadoresIncompletosRes = await pool.query(
    `SELECT
       rut_jugador,
       nombres,
       apellido_paterno,
       rama,
       categoria,
       correo_apoderado,
       updated_at,
       CASE
         WHEN COALESCE(rut_jugador, '') = '' THEN TRUE
         WHEN NOT (UPPER(REPLACE(REPLACE(rut_jugador, '.', ''), '-', '')) ~ '^[0-9]{7,8}[0-9K]$') THEN TRUE
         ELSE FALSE
       END AS rut_invalido
     FROM jugadores
     WHERE COALESCE(TRIM(nombres), '') = ''
        OR COALESCE(TRIM(rut_jugador), '') = ''
        OR COALESCE(TRIM(rama), '') = ''
        OR COALESCE(TRIM(categoria), '') = ''
        OR NOT (UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) ~ '^[0-9]{7,8}[0-9K]$')
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 200`
  );

  const jugadoresIncompletos = jugadoresIncompletosRes.rows.map((jugador) => {
    const campos = [];
    if (!String(jugador.nombres || '').trim()) campos.push('nombres');
    if (!String(jugador.rut_jugador || '').trim()) campos.push('rut_jugador');
    if (jugador.rut_invalido) campos.push('rut_valido');
    if (!String(jugador.rama || '').trim()) campos.push('rama');
    if (!String(jugador.categoria || '').trim()) campos.push('categoria');

    return {
      rut_jugador: jugador.rut_jugador || '',
      nombres: jugador.nombres || '',
      apellido_paterno: jugador.apellido_paterno || '',
      rama: jugador.rama || '',
      categoria: jugador.categoria || '',
      correo_apoderado: jugador.correo_apoderado || '',
      campos_faltantes: campos,
      updated_at: jugador.updated_at,
    };
  });

  const pagosConCorreccionRes = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM pagos_mensualidades
     WHERE LOWER(COALESCE(estado_pago, '')) = 'pendiente'
       AND (
         LOWER(COALESCE(notas_tesoreria, '')) LIKE '%correccion requerida%'
         OR (COALESCE(TRIM(rut_jugador), '') = '' AND COALESCE(TRIM(rut_pagos), '') = '')
         OR COALESCE(TRIM(meses_correspondientes), '') = ''
       )`
  );

  const pagosConCorreccionListRes = await pool.query(
    `SELECT
       id,
       rut_jugador,
       correo_apoderado,
       meses_correspondientes,
       monto_total_pagado,
       estado_pago,
       notas_tesoreria,
       fecha_registro,
       updated_at
     FROM pagos_mensualidades
     WHERE LOWER(COALESCE(estado_pago, '')) = 'pendiente'
       AND (
         LOWER(COALESCE(notas_tesoreria, '')) LIKE '%correccion requerida%'
         OR (COALESCE(TRIM(rut_jugador), '') = '' AND COALESCE(TRIM(rut_pagos), '') = '')
         OR COALESCE(TRIM(meses_correspondientes), '') = ''
       )
     ORDER BY fecha_registro DESC NULLS LAST, id DESC
     LIMIT 300`
  );

    const pagosConCorreccion = pagosConCorreccionListRes.rows.map((pago) => ({
    id: pago.id,
    rut_jugador: pago.rut_jugador || '',
    correo_apoderado: pago.correo_apoderado || '',
    meses_correspondientes: pago.meses_correspondientes || '',
    monto_total_pagado: Number(pago.monto_total_pagado || 0),
    estado_pago: pago.estado_pago || 'pendiente',
    notas_tesoreria: pago.notas_tesoreria || '',
    fecha_registro: pago.fecha_registro,
    updated_at: pago.updated_at,
  }));

  return {
    totals: {
      cuentasIncompletas: cuentasIncompletas.length,
      jugadoresIncompletos: jugadoresIncompletosCountRes.rows[0]?.total || 0,
      pagosConCorreccion: pagosConCorreccionRes.rows[0]?.total || 0,
    },
    cuentasIncompletas: cuentasIncompletas.slice(0, 200),
    jugadoresIncompletos,
    pagosConCorreccion,
  };
};

const ensureSuperAdminAccount = async () => {
  const enabled = String(process.env.AUTO_BOOTSTRAP_SUPER_ADMIN || '').toLowerCase() === 'true';
  if (!enabled) return;

  const email = process.env.SUPER_ADMIN_EMAIL;
  const rut = process.env.SUPER_ADMIN_RUT;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const nombres = process.env.SUPER_ADMIN_NOMBRES || 'Super';
  const apellido = process.env.SUPER_ADMIN_APELLIDO || 'Admin';

  if (!email || !rut || !password) {
    console.warn('⚠️ AUTO_BOOTSTRAP_SUPER_ADMIN activo pero faltan variables SUPER_ADMIN_EMAIL/RUT/PASSWORD');
    return;
  }

  if (!validarRutChileno(rut)) {
    console.warn('⚠️ SUPER_ADMIN_RUT inválido, no se creó cuenta super admin');
    return;
  }

  const rutFmt = formatearRut(rut);
  const passwordHash = await hashPassword(password);

  await pool.query(
    `INSERT INTO cuentas (
      correo, rut, password, nombres, apellido_paterno, rol, estado,
      es_socio, forzar_clave, autorizacion_imagen
    ) VALUES ($1,$2,$3,$4,$5,'super_admin','activo',false,false,true)
    ON CONFLICT (correo)
    DO UPDATE SET
      rut = EXCLUDED.rut,
      password = EXCLUDED.password,
      nombres = EXCLUDED.nombres,
      apellido_paterno = EXCLUDED.apellido_paterno,
      rol = 'super_admin',
      estado = 'activo',
      updated_at = NOW()`,
    [email, rutFmt, passwordHash, nombres, apellido]
  );

  console.log(`🔐 Super admin asegurado: ${email} (${rutFmt})`);
};

const ensureCuentasExtendedColumns = async () => {
  const ddl = [
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS perfil_principal VARCHAR(50) DEFAULT 'apoderado'`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS cargo_directiva VARCHAR(50)`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS socio_admin BOOLEAN DEFAULT false`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS aprobado_superadmin BOOLEAN DEFAULT false`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS acceso_nivel VARCHAR(30) DEFAULT 'estandar'`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS utm_valor_referencia DECIMAL(12,2)`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS monto_mensual_base DECIMAL(12,2)`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS monto_mensual_override DECIMAL(12,2)`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS condiciones_pago TEXT`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS fecha_corte_utm DATE`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS permisos_override JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS requiere_foto_perfil BOOLEAN DEFAULT false`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log('🧩 Columnas extendidas de cuentas verificadas');
};

const ensurePartidosLiveLogos = async () => {
  const ddl = [
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS logo_local_url VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS logo_visitante_url VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS torneo_nombre VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS torneo_logo_url VARCHAR(255)`,
  ];
  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log('🏆 Columnas de logos en partidos_live verificadas');
};

const ensurePartidosLiveCoreColumns = async () => {
  const ddl = [
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS rama VARCHAR(50) DEFAULT 'Mixta'`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'SUB-13'`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }

  console.log('🏀 Columnas base rama/categoria en partidos_live verificadas');
};

const ensurePartidosLiveMesaColumns = async () => {
  const ddl = [
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS competencia_nombre VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS competencia_logo_url VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS mesa_payload JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS play_by_play_json JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS eventos_json JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS operadores_json JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS analisis_json JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS iniciado_at TIMESTAMP`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS finalizado_at TIMESTAMP`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }

  console.log('📋 Columnas avanzadas de mesa en partidos_live verificadas');
};

const ensurePagosMensualidadesColumns = async () => {
  const ddl = [
    `ALTER TABLE pagos_mensualidades ADD COLUMN IF NOT EXISTS rut_pagos VARCHAR(20)`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }

  console.log('💳 Columnas de pagos_mensualidades verificadas');
};

const ensureLogoAssetsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logo_assets (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255),
      tipo VARCHAR(50) DEFAULT 'logo',
      filename VARCHAR(255) UNIQUE NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_data BYTEA NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('🖼️ Tabla logo_assets verificada');
};

// Kiosco POS: el módulo vivía 100% en memoria del navegador (sin backend detrás),
// por lo que turnos, fiados y ventas se perdían al recargar o cerrar sesión.
// Estas tablas le dan persistencia real: catálogo de productos, turnos de caja
// (apertura/cierre con firma), ventas línea a línea (base real de la analítica,
// sin los números de muestra que traía el mock del frontend), cuentas pendientes
// con su historial de cargos/pagos, y egresos ligados a cada turno.
const ensureKioscoTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_productos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      emoji VARCHAR(10) DEFAULT '📦',
      categoria VARCHAR(100) DEFAULT 'General',
      costo NUMERIC(10,2) DEFAULT 0,
      precio NUMERIC(10,2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      activo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_turnos (
      id SERIAL PRIMARY KEY,
      responsable VARCHAR(255) NOT NULL,
      dia DATE NOT NULL,
      monto_inicial NUMERIC(10,2) NOT NULL DEFAULT 0,
      estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
      fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_cierre TIMESTAMP,
      ticket_final INTEGER DEFAULT 0,
      total_efectivo_ventas NUMERIC(10,2) DEFAULT 0,
      total_transferencia_ventas NUMERIC(10,2) DEFAULT 0,
      total_egresos NUMERIC(10,2) DEFAULT 0,
      total_pendientes NUMERIC(10,2) DEFAULT 0,
      caja_neta_final NUMERIC(10,2) DEFAULT 0,
      firma_base64 TEXT,
      cerrado_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_ventas (
      id SERIAL PRIMARY KEY,
      turno_id INTEGER REFERENCES kiosco_turnos(id) ON DELETE SET NULL,
      ticket_numero INTEGER,
      producto_id INTEGER,
      producto_nombre VARCHAR(255) NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario NUMERIC(10,2) NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      metodo_pago VARCHAR(20) NOT NULL,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_fiados (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      detalle TEXT,
      monto_total NUMERIC(10,2) NOT NULL DEFAULT 0,
      estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_ultimo_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_fiados_movimientos (
      id SERIAL PRIMARY KEY,
      fiado_id INTEGER NOT NULL REFERENCES kiosco_fiados(id) ON DELETE CASCADE,
      tipo VARCHAR(20) NOT NULL,
      monto NUMERIC(10,2) NOT NULL,
      metodo_pago VARCHAR(20),
      turno_id INTEGER REFERENCES kiosco_turnos(id) ON DELETE SET NULL,
      ticket_numero INTEGER,
      detalle TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_egresos (
      id SERIAL PRIMARY KEY,
      turno_id INTEGER REFERENCES kiosco_turnos(id) ON DELETE SET NULL,
      descripcion VARCHAR(255) NOT NULL,
      monto NUMERIC(10,2) NOT NULL,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('🛒 Tablas de kiosco POS verificadas');
};

app.post('/api/logo-assets', authenticate, requireModule('admin_dashboard'), uploadLogoMemoria.single('archivo'), async (req, res) => {
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

    try {
      fs.writeFileSync(path.join(logosPublicDir, filename), req.file.buffer);
    } catch {
      // El espejo en disco es opcional; la fuente principal queda en DB.
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
    return res.status(500).json({ error: error.message || 'No se pudo subir el logo.' });
  }
});

app.get('/api/logo-assets/list', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT filename, nombre, tipo, created_at
       FROM logo_assets
       ORDER BY created_at DESC, filename ASC`
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
    return res.status(500).json({ error: error.message || 'No se pudo listar los logos.' });
  }
});

app.get('/api/logo-assets/file/:filename', async (req, res) => {
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

    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.contentType(row.mime_type || 'application/octet-stream');
    return res.send(row.file_data);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo obtener el logo.' });
  }
});

app.delete('/api/logo-assets/:filename', authenticate, requireModule('admin_dashboard'), async (req, res) => {
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
    return res.status(500).json({ error: error.message || 'No se pudo borrar el logo.' });
  }
});

const getBackupStatus = () => {
  const maxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 36);
  const nowMs = Date.now();
  const maxAgeMs = Number.isFinite(maxAgeHours) && maxAgeHours > 0
    ? maxAgeHours * 60 * 60 * 1000
    : 36 * 60 * 60 * 1000;

  const cfg = getBackupConfig();
  const backupDir = cfg.backupDir;
  const manifestPath = cfg.manifestPath;

  const response = {
    configured: Boolean(backupDir || manifestPath),
    source: null,
    latestBackupPath: null,
    latestBackupAt: null,
    ageHours: null,
    maxAgeHours: Math.round(maxAgeMs / (60 * 60 * 1000)),
    healthy: false,
    warning: null,
    upload: null,
  };

  try {
    if (manifestPath) {
      if (!fs.existsSync(manifestPath)) {
        response.warning = `No existe BACKUP_MANIFEST_PATH: ${manifestPath}`;
        return response;
      }

      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw || '{}');
      const latestBackupAtRaw = manifest.lastSuccessAt || manifest.latestBackupAt || manifest.timestamp;
      const latestBackupAtMs = latestBackupAtRaw ? new Date(latestBackupAtRaw).getTime() : NaN;

      if (!Number.isFinite(latestBackupAtMs)) {
        response.source = 'manifest';
        response.warning = 'El manifest de backup no contiene una fecha válida (lastSuccessAt/latestBackupAt/timestamp).';
        response.latestBackupPath = manifest.filePath || manifest.latestBackupPath || null;
        return response;
      }

      const ageMs = Math.max(0, nowMs - latestBackupAtMs);
      response.source = 'manifest';
      response.latestBackupAt = new Date(latestBackupAtMs).toISOString();
      response.latestBackupPath = manifest.filePath || manifest.latestBackupPath || null;
      response.ageHours = Number((ageMs / (60 * 60 * 1000)).toFixed(2));
      response.healthy = ageMs <= maxAgeMs;
      if (manifest.upload) {
        response.upload = {
          attempted: Boolean(manifest.upload.attempted),
          uploaded: Boolean(manifest.upload.uploaded),
          bucket: manifest.upload.bucket || null,
          objectKey: manifest.upload.objectKey || null,
          endpoint: manifest.upload.endpoint || null,
          verifiedAt: manifest.upload.verifiedAt || null,
          reason: manifest.upload.reason || null,
        };
      }
      if (!response.healthy) {
        response.warning = `Último backup supera ventana máxima (${response.maxAgeHours}h).`;
      }
      return response;
    }

    if (!backupDir) {
      response.warning = 'No hay BACKUP_DIR ni BACKUP_MANIFEST_PATH configurados.';
      return response;
    }

    if (!fs.existsSync(backupDir)) {
      response.warning = `No existe BACKUP_DIR: ${backupDir}`;
      return response;
    }

    const files = fs.readdirSync(backupDir)
      .map((name) => {
        const fullPath = path.join(backupDir, name);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          return null;
        }
        if (!stat.isFile()) return null;
        if (!/\.(sql|dump|backup|bak|gz)$/i.test(name)) return null;
        return {
          fullPath,
          mtimeMs: stat.mtimeMs,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (files.length === 0) {
      response.source = 'directory';
      response.warning = `No se encontraron archivos de backup en ${backupDir}`;
      return response;
    }

    const latest = files[0];
    const ageMs = Math.max(0, nowMs - latest.mtimeMs);
    response.source = 'directory';
    response.latestBackupPath = latest.fullPath;
    response.latestBackupAt = new Date(latest.mtimeMs).toISOString();
    response.ageHours = Number((ageMs / (60 * 60 * 1000)).toFixed(2));
    response.healthy = ageMs <= maxAgeMs;
    if (!response.healthy) {
      response.warning = `Último backup supera ventana máxima (${response.maxAgeHours}h).`;
    }

    return response;
  } catch (error) {
    response.warning = `Error evaluando backups: ${error.message}`;
    return response;
  }
};

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.get('/api/admin/sync-sheets/status', (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Consulta de sincronizacion deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para consultar sincronizacion.' });
  }

  return res.json({
    running: isSheetsSyncRunning,
    lastSync: lastSheetsSyncStatus,
  });
});

app.get('/api/admin/ops-status', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Consulta operativa deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para consultar estado operativo.' });
  }

  try {
    const dbPing = await pool.query('SELECT NOW() AS db_now');
    const backup = getBackupStatus();
    const pagosSummary = await pool.query(
      `SELECT
         COUNT(*)::INT AS total,
         COUNT(*) FILTER (WHERE COALESCE(TRIM(rut_pagos), '') <> '')::INT AS con_rut_pagos,
         MAX(updated_at) AS ultimo_update
       FROM pagos_mensualidades`
    );

    return res.json({
      ok: true,
      db: {
        reachable: true,
        now: dbPing.rows[0]?.db_now || null,
      },
      sync: {
        running: isSheetsSyncRunning,
        lastSync: lastSheetsSyncStatus,
      },
      backup,
      pagosMensualidades: pagosSummary.rows[0] || null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'No se pudo obtener el estado operativo.',
      detail: error.message,
    });
  }
});

app.get('/api/admin/backup-status', (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Consulta de backup deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para consultar backup.' });
  }

  return res.json({
    ok: true,
    running: isBackupRunning,
    lastRun: lastBackupRunStatus,
    backup: getBackupStatus(),
    checkedAt: new Date().toISOString(),
  });
});

app.post('/api/admin/backup-run', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Ejecución de backup deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para ejecutar backup.' });
  }

  const result = await runDatabaseBackup({ trigger: 'manual_api' });
  if (!result.ok && !result.skipped) {
    return res.status(500).json(result);
  }
  if (result.skipped) {
    return res.status(409).json(result);
  }
  return res.json(result);
});

app.get('/api/admin/data-quality', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Consulta de calidad deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para consultar calidad.' });
  }

  try {
    const quality = await obtenerResumenCalidadDatos();
    return res.json({ ok: true, quality, generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo calcular calidad de datos.', detail: error.message });
  }
});

app.get('/api/admin/data-quality/details', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Consulta de detalle deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para consultar detalle de calidad.' });
  }

  try {
    const detail = await obtenerDetalleCalidadDatos();
    return res.json({ ok: true, detail, generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo calcular detalle de calidad.', detail: error.message });
  }
});

app.get('/api/admin/jugadores-rut-conflicts', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Consulta de conflictos deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para consultar conflictos de jugadores.' });
  }

  try {
    const detail = await obtenerConflictosRutJugadoresSheet();
    return res.json({ ok: true, detail, generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo calcular conflictos de jugadores.', detail: error.message });
  }
});

app.post('/api/admin/jugadores-rut-conflicts/resolve', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Resolucion de conflictos deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para resolver conflictos de jugadores.' });
  }

  const {
    rut,
    filaSheet,
    accion = 'correccion_manual',
    observaciones = '',
    usuario = 'superadmin',
  } = req.body || {};

  if (!String(rut || '').trim()) {
    return res.status(400).json({ error: 'rut es obligatorio para registrar la resolucion.' });
  }

  try {
    await pool.query(
      `INSERT INTO auditoria (
         usuario_id,
         tabla_afectada,
         tipo_accion,
         registro_id,
         valores_anteriores,
         valores_nuevos,
         ip_usuario,
         descripcion
       ) VALUES (
         NULL,
         'jugadores',
         'resolver_conflicto_rut',
         NULL,
         $1::json,
         $2::json,
         $3,
         $4
       )`,
      [
        JSON.stringify({ rut, filaSheet: filaSheet || null, estado: 'pendiente_revision' }),
        JSON.stringify({ accion, observaciones, usuario }),
        req.ip || req.headers['x-forwarded-for'] || 'desconocida',
        `Conflicto de RUT resuelto por superadmin. RUT: ${rut}${filaSheet ? ` | Fila sheet: ${filaSheet}` : ''}`,
      ]
    );

    return res.json({ ok: true, message: 'Resolucion registrada en auditoria.' });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo registrar la resolucion del conflicto.', detail: error.message });
  }
});

app.post('/api/admin/sync-sheets', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Sincronizacion deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para sincronizar.' });
  }

  if (isSheetsSyncRunning) {
    return res.status(409).json({ error: 'Ya hay una sincronizacion en curso.' });
  }

  isSheetsSyncRunning = true;
  lastSheetsSyncStatus = {
    status: 'running',
    startedAt: new Date().toISOString(),
    syncedAt: lastSheetsSyncStatus?.syncedAt || null,
    totals: lastSheetsSyncStatus?.totals || null,
    mode: 'incremental',
  };

  try {
    const result = await runImportFromSheets({ logger: console, incrementalOnly: true });
    const totals = result.summary.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.importadas += item.imported;
        acc.omitidas += item.skipped;
        acc.errores += item.errors;
        return acc;
      },
      { total: 0, importadas: 0, omitidas: 0, errores: 0 }
    );

    lastSheetsSyncStatus = {
      status: 'success',
      sheetId: result.sheetId,
      totals,
      detail: result.summary,
      mode: 'incremental',
      startedAt: lastSheetsSyncStatus?.startedAt || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };

    return res.json({
      ok: true,
      sheetId: result.sheetId,
      totals,
      detail: result.summary,
      mode: 'incremental',
      qualitySummary: result.qualitySummary || null,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    lastSheetsSyncStatus = {
      status: 'error',
      startedAt: lastSheetsSyncStatus?.startedAt || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      error: error.message,
    };
    return res.status(500).json({
      error: 'Fallo la sincronizacion desde Google Sheets.',
      detail: error.message,
    });
  } finally {
    isSheetsSyncRunning = false;
  }
});

app.post('/api/admin/sync-sheets/export', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Exportacion deshabilitada: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para exportar a Google Sheets.' });
  }

  try {
    const result = await sheetsSyncManager.syncAllMappedTables();
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: 'No se pudo exportar la base de datos al Google Sheet.',
      detail: error.message,
    });
  }
});

app.post('/api/admin/sync-sheets/webhook-ping', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Ping webhook deshabilitado: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para validar webhook.' });
  }

  const result = await sheetsWebhookSyncManager.sendPing();
  if (!result.ok) {
    return res.status(400).json(result);
  }

  return res.json({ ok: true, message: 'Webhook Google Sheets operativo.' });
});

app.post('/api/admin/sync-sheets/webhook-flush', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Flush webhook deshabilitado: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para forzar flush webhook.' });
  }

  try {
    await sheetsWebhookSyncManager.flush();
    return res.json({ ok: true, message: 'Flush webhook ejecutado.' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// AUTH: LOGIN BÁSICO POR RUT/PASSWORD
// ==========================================
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { rut, password } = req.body;

  if (!rut || !password) {
    return res.status(400).json({ error: 'rut y password son obligatorios' });
  }

  try {
    const rutNormalizado = normalizarRut(rut);
    let cuentaFinal = await obtenerCuentaPorRutNormalizado(rutNormalizado);

    if (!cuentaFinal) {
      const cuentaProvisionada = await provisionarCuentaJugadorSiCorresponde({ rutNormalizado, password });
      if (!cuentaProvisionada) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      cuentaFinal = cuentaProvisionada;
    }

    const cuenta = cuentaFinal;
    if (cuenta.estado && String(cuenta.estado).toLowerCase() !== 'activo') {
      return res.status(403).json({ error: 'Cuenta inactiva' });
    }

    const rolDb = String(cuenta.rol || '').toLowerCase();
    const esJugador = rolDb === 'jugador';

    if (!String(cuenta.password || '').trim() && esJugador && String(password || '') === '12345') {
      const passwordHashDefault = await hashPassword('12345');
      await pool.query(
        `UPDATE cuentas
         SET password = $2,
             forzar_clave = true,
             updated_at = NOW()
         WHERE id = $1`,
        [cuenta.id, passwordHashDefault]
      );
      cuentaFinal = await obtenerCuentaPorRutNormalizado(rutNormalizado);
    }

    const { valid, needsRehash } = await verifyPassword(password, cuentaFinal.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (needsRehash) {
      const passwordHash = await hashPassword(password);
      await pool.query(
        `UPDATE cuentas SET password = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, cuentaFinal.id]
      );
    }

    const rolSistema = rolDb === 'super_admin' || rolDb === 'superadmin' ? 'super_admin' : rolDb || 'jugador';
    const token = signToken({ id: cuentaFinal.id, rut: formatearRut(cuentaFinal.rut), rol: rolSistema });

    res.json({
      ok: true,
      token,
      user: {
        id: cuentaFinal.id,
        nombre: `${cuentaFinal.nombres || ''} ${cuentaFinal.apellido_paterno || ''}`.trim() || cuentaFinal.correo,
        correo: cuentaFinal.correo,
        rut: formatearRut(cuentaFinal.rut),
        rol: rolSistema,
        perfil_principal: cuentaFinal.perfil_principal || rolSistema,
        forzar_clave: Boolean(cuentaFinal.forzar_clave),
        foto_perfil_url: cuentaFinal.foto_perfil_url || null,
        requiere_foto_perfil: Boolean(cuentaFinal.requiere_foto_perfil),
        access_profiles: rolSistema === 'super_admin'
          ? ['super_admin', 'admin', 'staff', 'mesa', 'jugador', 'visita']
          : [rolSistema]
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', authRateLimiter, async (req, res) => {
  const { rut, currentPassword, newPassword } = req.body;

  if (!rut || !newPassword) {
    return res.status(400).json({ error: 'rut y newPassword son obligatorios' });
  }

  const nuevaClave = String(newPassword).trim();
  if (nuevaClave.length < 5) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 5 caracteres.' });
  }

  try {
    const rutNormalizado = normalizarRut(rut);
    const result = await pool.query(
      `SELECT id, password
       FROM cuentas
       WHERE UPPER(REPLACE(REPLACE(rut, '.', ''), '-', '')) = $1
       LIMIT 1`,
      [rutNormalizado]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada.' });
    }

    const cuenta = result.rows[0];
    const { valid } = await verifyPassword(currentPassword, cuenta.password);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual no coincide.' });
    }

    const nuevaClaveHash = await hashPassword(nuevaClave);
    await pool.query(
      `UPDATE cuentas
       SET password = $1,
           forzar_clave = false,
           updated_at = NOW()
       WHERE id = $2`,
      [nuevaClaveHash, cuenta.id]
    );

    return res.json({ ok: true, message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 1. ENDPOINTS: COMUNICACIONES
// ==========================================

// GET: Todas las comunicaciones
app.get('/api/comunicaciones', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, titulo, cuerpo_texto, tipo, rama, categoria, urgencia, 
        solicita_asistencia, reacciones, asistencias,
        created_at as fecha
      FROM comunicaciones 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Comunicación por ID
app.get('/api/comunicaciones/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicaciones WHERE id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear comunicación
app.post('/api/comunicaciones', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO comunicaciones 
       (titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia, reacciones, asistencias)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia || false, '{}', '[]']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar comunicación
app.put('/api/comunicaciones/:id', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { titulo, cuerpo_texto, urgencia } = req.body;
  try {
    const result = await pool.query(
      `UPDATE comunicaciones 
       SET titulo = $1, cuerpo_texto = $2, urgencia = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [titulo, cuerpo_texto, urgencia, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Eliminar comunicación
app.delete('/api/comunicaciones/:id', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    await pool.query('DELETE FROM comunicaciones WHERE id = $1', [req.params.id]);
    res.json({ message: 'Comunicación eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. ENDPOINTS: COMENTARIOS
// ==========================================

// GET: Comentarios de una comunicación
app.get('/api/comunicaciones/:comId/comentarios', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM comentarios 
       WHERE comunicacion_id = $1 
       ORDER BY created_at ASC`,
      [req.params.comId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear comentario
app.post('/api/comunicaciones/:comId/comentarios', authenticate, requireModule('comunicaciones'), async (req, res) => {
  const { usuario_id, texto, parent_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO comentarios 
       (comunicacion_id, usuario_id, texto, parent_id, likes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.comId, usuario_id, texto, parent_id || null, 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Like comentario
app.put('/api/comentarios/:comentId/like', authenticate, requireModule('comunicaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE comentarios 
       SET likes = likes + 1
       WHERE id = $1
       RETURNING *`,
      [req.params.comentId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. ENDPOINTS: PAGOS & TESORERÍA
// ==========================================

// GET: Pagos por usuario
app.get('/api/pagos/usuario/:usuarioId', authenticate, requireOwnerIdOrModule('usuarioId', 'validacion_pagos'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pagos 
       WHERE usuario_id = $1 
       ORDER BY created_at DESC`,
      [req.params.usuarioId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Todos los pagos (admin)
app.get('/api/pagos', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.nombre 
       FROM pagos p
       LEFT JOIN usuarios u ON p.usuario_id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pago
app.post('/api/pagos', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { usuario_id, monto, tipo, estado, comprobante } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO pagos 
       (usuario_id, monto, tipo, estado, comprobante)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [usuario_id, monto, tipo, estado || 'pendiente', comprobante]
    );

    const usuarioRes = await client.query(
      `SELECT email FROM usuarios WHERE id = $1 LIMIT 1`,
      [usuario_id]
    );

    const rutJugadorMirror = null;
    const correccionesPago = [];
    if (!rutJugadorMirror) {
      correccionesPago.push('rut_jugador pendiente de asignacion');
    }
    const estadoMensualidad = correccionesPago.length > 0
      ? 'pendiente'
      : normalizarEstadoPagoMensualidad(estado || 'pendiente');
    const fechaMesActual = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    await client.query(
      `INSERT INTO pagos_mensualidades (
         rut_jugador,
         correo_apoderado,
         concepto_pago,
         cantidad_meses_pagados,
         meses_correspondientes,
         monto_total_pagado,
         comprobante_url,
         estado_pago,
         fecha_aprobacion,
         notas_tesoreria,
         updated_at
       ) VALUES (
         $1,
         $2,
         $3,
         1,
         $4,
         $5,
         $6,
         $7,
         CASE WHEN $7 = 'aprobado' THEN NOW() ELSE NULL END,
         $8,
         NOW()
       )`,
      [
        rutJugadorMirror,
        usuarioRes.rows[0]?.email || null,
        tipo || 'Pago general',
        fechaMesActual,
        monto,
        comprobante || null,
        estadoMensualidad,
        correccionesPago.length > 0
          ? `Origen: /api/pagos (registro automático) | Correccion requerida: ${correccionesPago.join(', ')}`
          : 'Origen: /api/pagos (registro automático)',
      ]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT: Validar pago (admin)
app.put('/api/pagos/:pagoId/validar', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { estado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pagos 
       SET estado = $1, fecha_pago = NOW()
       WHERE id = $2
       RETURNING *`,
      [estado, req.params.pagoId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ENDPOINTS: USUARIOS
// ==========================================

// GET: Todos los usuarios
app.get('/api/usuarios', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, telefono, rol, activo, created_at 
       FROM usuarios 
       ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Usuario por ID
app.get('/api/usuarios/:id', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, telefono, rol, activo FROM usuarios WHERE id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear usuario
app.post('/api/usuarios', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { nombre, email, telefono, rol } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, telefono, rol, activo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [nombre, email, telefono, rol]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4.1 ENDPOINTS: CUENTAS (APODERADOS/SOCIOS/STAFF)
// ==========================================

// GET: Todas las cuentas
app.get('/api/cuentas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cuentas ORDER BY apellido_paterno ASC, nombres ASC`
    );

    const cuentas = result.rows.map((cuenta) => ({
      ...omitPassword(cuenta),
      rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    }));

    res.json(cuentas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Cuentas con información incompleta
app.get('/api/cuentas/incompletas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cuentas ORDER BY updated_at DESC');
    const incompletas = result.rows
      .map((cuenta) => ({
        ...omitPassword(cuenta),
        rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
        campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
      }))
      .filter((cuenta) => cuenta.campos_faltantes.length > 0);

    res.json(incompletas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Cuenta por ID
app.get('/api/cuentas/:id', authenticate, requireOwnerIdOrModule('id', 'admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cuentas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const cuenta = result.rows[0];
    res.json({
      ...omitPassword(cuenta),
      rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear cuenta
app.post('/api/cuentas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const {
    correo,
    rut,
    password,
    nombres,
    apellido_paterno,
    apellido_materno,
    fecha_nacimiento,
    estado_civil,
    direccion,
    comuna,
    prefijo_tel,
    telefono,
    profesion_oficio,
    nombre_segundo_contacto,
    parentesco_segundo_contacto,
    num_segundo_contacto,
    es_socio,
    fecha_ingreso_socio,
    rol,
    perfil_principal,
    cargo_directiva,
    socio_admin,
    aprobado_superadmin,
    acceso_nivel,
    utm_valor_referencia,
    monto_mensual_base,
    monto_mensual_override,
    condiciones_pago,
    fecha_corte_utm,
    permisos_override,
    forzar_clave,
    foto_perfil_url,
    requiere_foto_perfil,
    logo_url,
    estado,
    autorizacion_imagen,
    dia_pago_acordado,
  } = req.body;

  if (!correo || !rut) {
    return res.status(400).json({ error: 'correo y rut son obligatorios' });
  }

  if (!validarRutChileno(rut)) {
    return res.status(400).json({ error: 'RUT chileno inválido' });
  }

  try {
    const rutNormalizado = formatearRut(rut);
    const logoPerfilUrl = foto_perfil_url || logo_url || null;
    const passwordHash = password ? await hashPassword(password) : null;
    const result = await pool.query(
      `INSERT INTO cuentas (
        correo, rut, password, nombres, apellido_paterno, apellido_materno,
        fecha_nacimiento, estado_civil, direccion, comuna, prefijo_tel, telefono,
        profesion_oficio, nombre_segundo_contacto, parentesco_segundo_contacto,
        num_segundo_contacto, es_socio, fecha_ingreso_socio, rol, perfil_principal,
        cargo_directiva, socio_admin, aprobado_superadmin, acceso_nivel,
        utm_valor_referencia, monto_mensual_base, monto_mensual_override,
        condiciones_pago, fecha_corte_utm, permisos_override, forzar_clave, foto_perfil_url,
        requiere_foto_perfil, estado, autorizacion_imagen, dia_pago_acordado
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36
      ) RETURNING *`,
      [
        correo,
        rutNormalizado,
        passwordHash,
        nombres || null,
        apellido_paterno || null,
        apellido_materno || null,
        fecha_nacimiento || null,
        estado_civil || null,
        direccion || null,
        comuna || null,
        prefijo_tel || null,
        telefono || null,
        profesion_oficio || null,
        nombre_segundo_contacto || null,
        parentesco_segundo_contacto || null,
        num_segundo_contacto || null,
        es_socio ?? false,
        fecha_ingreso_socio || null,
        rol || 'apoderado',
        perfil_principal || rol || 'apoderado',
        cargo_directiva || null,
        socio_admin ?? false,
        aprobado_superadmin ?? false,
        acceso_nivel || 'estandar',
        utm_valor_referencia || null,
        monto_mensual_base || null,
        monto_mensual_override || null,
        condiciones_pago || null,
        fecha_corte_utm || null,
        permisos_override && typeof permisos_override === 'object' ? JSON.stringify(permisos_override) : JSON.stringify({}),
        forzar_clave ?? false,
        logoPerfilUrl,
        requiere_foto_perfil ?? false,
        estado || 'activo',
        autorizacion_imagen ?? false,
        dia_pago_acordado || null,
      ]
    );

    const cuenta = result.rows[0];
    res.json({
      ...omitPassword(cuenta),
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'correo o rut ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar cuenta
const CAMPOS_CUENTA_SOLO_ADMIN = [
  'rol', 'perfil_principal', 'cargo_directiva', 'socio_admin', 'aprobado_superadmin',
  'acceso_nivel', 'utm_valor_referencia', 'monto_mensual_base', 'monto_mensual_override',
  'condiciones_pago', 'fecha_corte_utm', 'permisos_override', 'forzar_clave', 'estado',
  'autorizacion_imagen', 'dia_pago_acordado', 'es_socio', 'fecha_ingreso_socio',
];

app.put(
  '/api/cuentas/:id',
  authenticate,
  requireOwnerIdOrModule('id', 'admin_dashboard'),
  stripFieldsUnlessModule(CAMPOS_CUENTA_SOLO_ADMIN, 'admin_dashboard'),
  async (req, res) => {
  const {
    correo,
    rut,
    password,
    nombres,
    apellido_paterno,
    apellido_materno,
    fecha_nacimiento,
    estado_civil,
    direccion,
    comuna,
    prefijo_tel,
    telefono,
    profesion_oficio,
    nombre_segundo_contacto,
    parentesco_segundo_contacto,
    num_segundo_contacto,
    es_socio,
    fecha_ingreso_socio,
    rol,
    perfil_principal,
    cargo_directiva,
    socio_admin,
    aprobado_superadmin,
    acceso_nivel,
    utm_valor_referencia,
    monto_mensual_base,
    monto_mensual_override,
    condiciones_pago,
    fecha_corte_utm,
    permisos_override,
    forzar_clave,
    foto_perfil_url,
    requiere_foto_perfil,
    estado,
    autorizacion_imagen,
    dia_pago_acordado,
    logo_url,
  } = req.body;

  if (rut && !validarRutChileno(rut)) {
    return res.status(400).json({ error: 'RUT chileno inválido' });
  }

  try {
    const rutNormalizado = rut ? formatearRut(rut) : null;
    const logoPerfilUrl = foto_perfil_url || logo_url || null;
    const passwordHash = password ? await hashPassword(password) : null;
    const result = await pool.query(
      `UPDATE cuentas SET
        correo = COALESCE($1, correo),
        rut = COALESCE($2, rut),
        password = COALESCE($3, password),
        nombres = COALESCE($4, nombres),
        apellido_paterno = COALESCE($5, apellido_paterno),
        apellido_materno = COALESCE($6, apellido_materno),
        fecha_nacimiento = COALESCE($7, fecha_nacimiento),
        estado_civil = COALESCE($8, estado_civil),
        direccion = COALESCE($9, direccion),
        comuna = COALESCE($10, comuna),
        prefijo_tel = COALESCE($11, prefijo_tel),
        telefono = COALESCE($12, telefono),
        profesion_oficio = COALESCE($13, profesion_oficio),
        nombre_segundo_contacto = COALESCE($14, nombre_segundo_contacto),
        parentesco_segundo_contacto = COALESCE($15, parentesco_segundo_contacto),
        num_segundo_contacto = COALESCE($16, num_segundo_contacto),
        es_socio = COALESCE($17, es_socio),
        fecha_ingreso_socio = COALESCE($18, fecha_ingreso_socio),
        rol = COALESCE($19, rol),
        perfil_principal = COALESCE($20, perfil_principal),
        cargo_directiva = COALESCE($21, cargo_directiva),
        socio_admin = COALESCE($22, socio_admin),
        aprobado_superadmin = COALESCE($23, aprobado_superadmin),
        acceso_nivel = COALESCE($24, acceso_nivel),
        utm_valor_referencia = COALESCE($25, utm_valor_referencia),
        monto_mensual_base = COALESCE($26, monto_mensual_base),
        monto_mensual_override = COALESCE($27, monto_mensual_override),
        condiciones_pago = COALESCE($28, condiciones_pago),
        fecha_corte_utm = COALESCE($29, fecha_corte_utm),
        permisos_override = COALESCE($30::jsonb, permisos_override),
        forzar_clave = COALESCE($31, forzar_clave),
        foto_perfil_url = COALESCE($32, foto_perfil_url),
        requiere_foto_perfil = COALESCE($33, requiere_foto_perfil),
        estado = COALESCE($34, estado),
        autorizacion_imagen = COALESCE($35, autorizacion_imagen),
        dia_pago_acordado = COALESCE($36, dia_pago_acordado),
        updated_at = NOW()
      WHERE id = $37
      RETURNING *`,
      [
        correo || null,
        rutNormalizado,
        passwordHash,
        nombres || null,
        apellido_paterno || null,
        apellido_materno || null,
        fecha_nacimiento || null,
        estado_civil || null,
        direccion || null,
        comuna || null,
        prefijo_tel || null,
        telefono || null,
        profesion_oficio || null,
        nombre_segundo_contacto || null,
        parentesco_segundo_contacto || null,
        num_segundo_contacto || null,
        es_socio,
        fecha_ingreso_socio || null,
        rol || null,
        perfil_principal || null,
        cargo_directiva || null,
        socio_admin,
        aprobado_superadmin,
        acceso_nivel || null,
        utm_valor_referencia || null,
        monto_mensual_base || null,
        monto_mensual_override || null,
        condiciones_pago || null,
        fecha_corte_utm || null,
        permisos_override && typeof permisos_override === 'object' ? JSON.stringify(permisos_override) : null,
        forzar_clave,
        logoPerfilUrl,
        requiere_foto_perfil,
        estado || null,
        autorizacion_imagen,
        dia_pago_acordado || null,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const cuenta = result.rows[0];
    res.json({
      ...omitPassword(cuenta),
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'correo o rut ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Borrar cuenta definitivamente (solo super admin)
app.delete('/api/cuentas/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  const actor = req.actor;

  const idCuenta = Number.parseInt(String(req.params.id || ''), 10);
  if (!Number.isFinite(idCuenta) || idCuenta <= 0) {
    return res.status(400).json({ error: 'ID de cuenta inválido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cuentaRes = await client.query(
      `SELECT id, correo, rut, rol, perfil_principal
       FROM cuentas
       WHERE id = $1
       LIMIT 1`,
      [idCuenta]
    );

    if (cuentaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta no encontrada.' });
    }

    const cuenta = cuentaRes.rows[0];
    const rolCuenta = normalizarRolSistema(cuenta.rol || cuenta.perfil_principal || '');
    if (rolCuenta === 'super_admin') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se puede borrar una cuenta super admin.' });
    }

    const rutCuentaNormalizado = normalizarRut(cuenta.rut || '');
    if ((actor.id && String(actor.id) === String(cuenta.id)) || (actor.rut && normalizarRut(actor.rut) === rutCuentaNormalizado)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No puedes borrar tu propia cuenta.' });
    }

    let jugadoresDesvinculados = 0;
    const correoCuenta = String(cuenta.correo || '').trim().toLowerCase();
    if (correoCuenta) {
      const desvincular = await client.query(
        `UPDATE jugadores
         SET correo_apoderado = ''
         WHERE LOWER(COALESCE(correo_apoderado, '')) = $1`,
        [correoCuenta]
      );
      jugadoresDesvinculados = desvincular.rowCount || 0;
    }

    await client.query('DELETE FROM cuentas WHERE id = $1', [idCuenta]);

    await client.query('COMMIT');
    return res.json({
      ok: true,
      message: 'Cuenta eliminada definitivamente.',
      deleted: { id: idCuenta },
      jugadores_desvinculados: jugadoresDesvinculados,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignorar errores secundarios de rollback.
    }
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. ENDPOINTS: CONTACTOS WHATSAPP
// ==========================================

// GET: Contactos WhatsApp
app.get('/api/whatsapp/contactos', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contactos_whatsapp WHERE activo = true ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Agregar contacto WhatsApp
app.post('/api/whatsapp/contactos', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { nombre, numero } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO contactos_whatsapp (nombre, numero, activo)
       VALUES ($1, $2, true)
       RETURNING *`,
      [nombre, numero]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Número ya existe' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE: Eliminar contacto WhatsApp
app.delete('/api/whatsapp/contactos/:id', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE contactos_whatsapp SET activo = false WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Contacto eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Enviar mensaje WhatsApp (simulado)
app.post('/api/whatsapp/enviar', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { numero, mensaje, tipo } = req.body;
  try {
    // Guardar en historial
    const result = await pool.query(
      `INSERT INTO historial_whatsapp (numero, mensaje, tipo, estado)
       VALUES ($1, $2, $3, 'enviado')
       RETURNING *`,
      [numero, mensaje, tipo]
    );
    
    // Simular webhook después de 2s
    setTimeout(() => {
      pool.query(
        `UPDATE historial_whatsapp SET estado = 'entregado' WHERE id = $1`,
        [result.rows[0].id]
      );
    }, 2000);
    
    res.json({ success: true, mensaje_id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ENDPOINTS: REPORTES & ANALYTICS
// ==========================================

// GET: Reportes de engagement
app.get('/api/reportes/engagement', authenticate, requireModule('reportes'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM comunicaciones) as total_comunicaciones,
        (SELECT SUM(CAST(reacciones->>key AS INTEGER)) FROM comunicaciones, jsonb_object_keys(reacciones) key) as total_reacciones,
        (SELECT COUNT(*) FROM comentarios) as total_comentarios,
        (SELECT COUNT(DISTINCT usuario_id) FROM comentarios) as usuarios_activos
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Top comunicaciones
app.get('/api/reportes/top-comunicaciones', authenticate, requireModule('reportes'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.titulo,
        COUNT(com.id) as comentarios,
        (SELECT SUM(CAST(value AS INTEGER)) FROM jsonb_each_text(c.reacciones)) as reacciones
      FROM comunicaciones c
      LEFT JOIN comentarios com ON c.id = com.comunicacion_id
      GROUP BY c.id, c.titulo
      ORDER BY comentarios DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. ENCUESTAS
// ==========================================

// GET: Encuestas
app.get('/api/encuestas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM encuestas ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear encuesta
app.post('/api/encuestas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { pregunta, opciones } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO encuestas (pregunta, opciones, votos)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [pregunta, JSON.stringify(opciones), JSON.stringify({})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Votar en encuesta
app.put('/api/encuestas/:encuestaId/votar', authenticate, requireModule('comunicaciones'), async (req, res) => {
  const { opcion } = req.body;
  try {
    const encuesta = await pool.query('SELECT votos FROM encuestas WHERE id = $1', [req.params.encuestaId]);
    const votos = encuesta.rows[0]?.votos || {};
    votos[opcion] = (votos[opcion] || 0) + 1;
    
    const result = await pool.query(
      'UPDATE encuestas SET votos = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(votos), req.params.encuestaId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. TASKS AUTOMÁTICAS (Cron)
// ==========================================

// Sincronizar con Google Sheets cada 24h (configurable después)
cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] Sincronizando con Google Sheets...');
  // TODO: Implementar sincronización con Google Sheets API
});

// Limpiar notificaciones antiguas cada 7 días
cron.schedule('0 3 * * 0', async () => {
  console.log('[CRON] Limpiando notificaciones antiguas...');
  await pool.query(`
    DELETE FROM notificaciones 
    WHERE created_at < NOW() - INTERVAL '30 days'
  `);
});

// ==========================================
// 9. ENDPOINTS: JUGADORES (FASE 1)
// ==========================================

// GET: Todos los jugadores
// Sin gate de módulo: casi todos los roles reales (jugador/apoderado vía
// bootstrap para resolver su propio pupilo, staff, mesa para el roster en
// vivo, admin) necesitan esta lista hoy. Solo se exige sesión válida.
app.get('/api/jugadores', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jugadores ORDER BY apellido_paterno ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Jugador por RUT
app.get('/api/jugadores/:rut', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM jugadores WHERE rut_jugador = $1',
      [req.params.rut]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear jugador
app.post('/api/jugadores', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const {
    rut_jugador,
    nombres,
    apellido_paterno,
    apellido_materno,
    rama,
    categoria,
    correo_apoderado,
    foto_jugador,
  } = req.body;
  try {
    const columnasJugadores = await obtenerColumnasTabla('jugadores');
    const columnas = ['rut_jugador', 'nombres', 'apellido_paterno', 'apellido_materno', 'rama', 'categoria', 'correo_apoderado', 'estado'];
    const valores = [rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, correo_apoderado, 'activo'];

    if (foto_jugador !== undefined && columnasJugadores.has('foto_jugador')) {
      columnas.push('foto_jugador');
      valores.push(foto_jugador);
    }

    const placeholders = columnas.map((_columna, indice) => `$${indice + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO jugadores (${columnas.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      valores
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar jugador por RUT
app.put('/api/jugadores/:rut', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const {
    correo_apoderado,
    correo_jugador,
    password_jugador,
    forzar_clave_jugador,
    parentesco_apoderado,
    nombres,
    apellido_paterno,
    apellido_materno,
    fecha_nacimiento,
    año_nacimiento,
    colegio,
    rama,
    categoria,
    posicion_de_juego,
    estatura,
    peso,
    mano_habil,
    numero_camiseta,
    club_anterior,
    fecha_ingreso,
    mes_inicio_cobro,
    beca,
    valor_mensualidad,
    matricula_pagada,
    talla_camiseta,
    talla_short,
    polera_entregada,
    poleron_entregado,
    derechos_imagen,
    prevision,
    tipo_sangre,
    alergias,
    nombre_emergencia,
    parentesco_emergencia,
    num_emergencia,
    estado,
    foto_jugador,
    estado_deportivo,
    fecha_inicio_baja,
    fecha_fin_baja,
    xp_puntos,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE jugadores SET
        correo_apoderado = COALESCE($1, correo_apoderado),
        correo_jugador = COALESCE($2, correo_jugador),
        password_jugador = COALESCE($3, password_jugador),
        forzar_clave_jugador = COALESCE($4, forzar_clave_jugador),
        parentesco_apoderado = COALESCE($5, parentesco_apoderado),
        nombres = COALESCE($6, nombres),
        apellido_paterno = COALESCE($7, apellido_paterno),
        apellido_materno = COALESCE($8, apellido_materno),
        fecha_nacimiento = COALESCE($9, fecha_nacimiento),
        año_nacimiento = COALESCE($10, año_nacimiento),
        colegio = COALESCE($11, colegio),
        rama = COALESCE($12, rama),
        categoria = COALESCE($13, categoria),
        posicion_de_juego = COALESCE($14, posicion_de_juego),
        estatura = COALESCE($15, estatura),
        peso = COALESCE($16, peso),
        mano_habil = COALESCE($17, mano_habil),
        numero_camiseta = COALESCE($18, numero_camiseta),
        club_anterior = COALESCE($19, club_anterior),
        fecha_ingreso = COALESCE($20, fecha_ingreso),
        mes_inicio_cobro = COALESCE($21, mes_inicio_cobro),
        beca = COALESCE($22, beca),
        valor_mensualidad = COALESCE($23, valor_mensualidad),
        matricula_pagada = COALESCE($24, matricula_pagada),
        talla_camiseta = COALESCE($25, talla_camiseta),
        talla_short = COALESCE($26, talla_short),
        polera_entregada = COALESCE($27, polera_entregada),
        poleron_entregado = COALESCE($28, poleron_entregado),
        derechos_imagen = COALESCE($29, derechos_imagen),
        prevision = COALESCE($30, prevision),
        tipo_sangre = COALESCE($31, tipo_sangre),
        alergias = COALESCE($32, alergias),
        nombre_emergencia = COALESCE($33, nombre_emergencia),
        parentesco_emergencia = COALESCE($34, parentesco_emergencia),
        num_emergencia = COALESCE($35, num_emergencia),
        estado = COALESCE($36, estado),
        foto_jugador = COALESCE($37, foto_jugador),
        estado_deportivo = COALESCE($38, estado_deportivo),
        fecha_inicio_baja = COALESCE($39, fecha_inicio_baja),
        fecha_fin_baja = COALESCE($40, fecha_fin_baja),
        xp_puntos = COALESCE($41, xp_puntos),
        updated_at = NOW()
      WHERE rut_jugador = $42
      RETURNING *`,
      [
        correo_apoderado ?? null,
        correo_jugador ?? null,
        password_jugador ?? null,
        forzar_clave_jugador ?? null,
        parentesco_apoderado ?? null,
        nombres ?? null,
        apellido_paterno ?? null,
        apellido_materno ?? null,
        fecha_nacimiento ?? null,
        año_nacimiento ?? null,
        colegio ?? null,
        rama ?? null,
        categoria ?? null,
        posicion_de_juego ?? null,
        estatura ?? null,
        peso ?? null,
        mano_habil ?? null,
        numero_camiseta ?? null,
        club_anterior ?? null,
        fecha_ingreso ?? null,
        mes_inicio_cobro ?? null,
        beca ?? null,
        valor_mensualidad ?? null,
        matricula_pagada ?? null,
        talla_camiseta ?? null,
        talla_short ?? null,
        polera_entregada ?? null,
        poleron_entregado ?? null,
        derechos_imagen ?? null,
        prevision ?? null,
        tipo_sangre ?? null,
        alergias ?? null,
        nombre_emergencia ?? null,
        parentesco_emergencia ?? null,
        num_emergencia ?? null,
        estado ?? null,
        foto_jugador ?? null,
        estado_deportivo ?? null,
        fecha_inicio_baja ?? null,
        fecha_fin_baja ?? null,
        xp_puntos ?? null,
        req.params.rut,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Borrar jugador definitivamente (solo super admin)
app.delete('/api/jugadores/:rut', authenticate, requireRole('super_admin'), async (req, res) => {
  const actor = req.actor;

  const rutObjetivoNormalizado = normalizarRut(req.params.rut || '');
  if (!rutObjetivoNormalizado) {
    return res.status(400).json({ error: 'RUT de jugador inválido.' });
  }

  if (actor.rut && normalizarRut(actor.rut) === rutObjetivoNormalizado) {
    return res.status(400).json({ error: 'No puedes borrar tu propio registro por RUT.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jugadorRes = await client.query(
      `SELECT rut_jugador
       FROM jugadores
       WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1
       LIMIT 1`,
      [rutObjetivoNormalizado]
    );

    if (jugadorRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }

    const cleanupTables = await client.query(
      `SELECT table_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name IN ('rut_jugador', 'rut_pagos')
         AND table_name <> 'jugadores'
       GROUP BY table_name
       ORDER BY table_name ASC`
    );

    const resumenEliminados = {};
    for (const row of cleanupTables.rows) {
      const tableName = String(row.table_name || '').trim();
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) continue;

      const columnsRes = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name IN ('rut_jugador', 'rut_pagos')`,
        [tableName]
      );

      const tieneRutJugador = columnsRes.rows.some((col) => col.column_name === 'rut_jugador');
      const tieneRutPagos = columnsRes.rows.some((col) => col.column_name === 'rut_pagos');
      if (!tieneRutJugador && !tieneRutPagos) continue;

      const condiciones = [];
      if (tieneRutJugador) {
        condiciones.push(`UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1`);
      }
      if (tieneRutPagos) {
        condiciones.push(`UPPER(REPLACE(REPLACE(COALESCE(rut_pagos, ''), '.', ''), '-', '')) = $1`);
      }

      const sql = `DELETE FROM ${quoteIdent(tableName)} WHERE ${condiciones.join(' OR ')}`;
      const deletedRes = await client.query(sql, [rutObjetivoNormalizado]);
      if ((deletedRes.rowCount || 0) > 0) {
        resumenEliminados[tableName] = deletedRes.rowCount;
      }
    }

    const deletedJugador = await client.query(
      `DELETE FROM jugadores
       WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1`,
      [rutObjetivoNormalizado]
    );

    if ((deletedJugador.rowCount || 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }

    await client.query('COMMIT');
    return res.json({
      ok: true,
      message: 'Jugador eliminado definitivamente.',
      deleted: { rut: rutObjetivoNormalizado },
      cleanup: resumenEliminados,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignorar errores secundarios de rollback.
    }
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 10. ENDPOINTS: PAGOS MENSUALIDADES (FASE 1)
// ==========================================

// GET: Todos los pagos de mensualidades
app.get('/api/pagos-mensualidades', authenticate, async (req, res) => {
  try {
    const incluirLegacy = ['1', 'true', 'yes', 'si'].includes(String(req.query.includeLegacy || '').trim().toLowerCase());
    const whereLegacy = incluirLegacy
      ? ''
      : `WHERE NOT (
           COALESCE(pm.monto_total_pagado, 0) <= 0
           AND (
             COALESCE(pm.meses_correspondientes, '') ~* '^sinmes\\b'
             OR LOWER(COALESCE(pm.notas_tesoreria, '')) LIKE '%correccion requerida%'
           )
         )`;

    const result = await pool.query(
      `SELECT pm.*, j.nombres, j.apellido_paterno
       FROM pagos_mensualidades pm
       LEFT JOIN jugadores j ON pm.rut_jugador = j.rut_jugador
       ${whereLegacy}
       ORDER BY pm.fecha_registro DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pago de mensualidad
app.post('/api/pagos-mensualidades', authenticate, requireAnyModule('perfil', 'validacion_pagos', 'admin_dashboard'), async (req, res) => {
  const {
    rut_jugador,
    rut_pagos,
    correo_apoderado,
    concepto_pago,
    cantidad_meses_pagados,
    meses_correspondientes,
    monto_total_pagado,
    comprobante_url,
  } = req.body;
  try {
    let rutPagosFinal = String(rut_pagos || '').trim();

    if (!rutPagosFinal) {
      if (String(correo_apoderado || '').trim()) {
        const cuentaPorCorreo = await pool.query(
          `SELECT rut
           FROM cuentas
           WHERE LOWER(COALESCE(correo, '')) = LOWER($1)
           LIMIT 1`,
          [correo_apoderado]
        );
        rutPagosFinal = String(cuentaPorCorreo.rows[0]?.rut || '').trim();
      }

      if (!rutPagosFinal && String(rut_jugador || '').trim()) {
        const cuentaDesdeJugador = await pool.query(
          `SELECT c.rut
           FROM jugadores j
           LEFT JOIN cuentas c
             ON LOWER(COALESCE(c.correo, '')) = LOWER(COALESCE(j.correo_apoderado, ''))
           WHERE UPPER(REPLACE(REPLACE(COALESCE(j.rut_jugador, ''), '.', ''), '-', '')) = UPPER(REPLACE(REPLACE($1, '.', ''), '-', ''))
           LIMIT 1`,
          [rut_jugador]
        );
        rutPagosFinal = String(cuentaDesdeJugador.rows[0]?.rut || '').trim();
      }
    }

    const correccionesPago = [];
    if (!String(rut_jugador || '').trim() && !String(rutPagosFinal || '').trim()) {
      correccionesPago.push('rut_jugador/rut_pagos vacio');
    }
    if (!String(meses_correspondientes || '').trim()) correccionesPago.push('meses_correspondientes vacio');
    if (!Number.isFinite(Number(monto_total_pagado)) || Number(monto_total_pagado) <= 0) {
      correccionesPago.push('monto_total_pagado invalido');
    }

    const result = await pool.query(
      `INSERT INTO pagos_mensualidades 
       (rut_jugador, rut_pagos, correo_apoderado, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, comprobante_url, estado_pago, notas_tesoreria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', $9)
       RETURNING *`,
      [
        rut_jugador,
        rutPagosFinal || null,
        correo_apoderado,
        concepto_pago,
        cantidad_meses_pagados,
        meses_correspondientes,
        monto_total_pagado,
        comprobante_url,
        correccionesPago.length > 0
          ? `Correccion requerida: ${correccionesPago.join(', ')}`
          : null,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Validar pago de mensualidad (admin)
app.put('/api/pagos-mensualidades/:id/validar', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { estado_pago } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pagos_mensualidades 
       SET estado_pago = $1, fecha_aprobacion = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [estado_pago, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Obtener pago específico por ID
app.get('/api/pagos-mensualidades/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pm.*, j.nombres, j.apellido_paterno
       FROM pagos_mensualidades pm
       LEFT JOIN jugadores j ON pm.rut_jugador = j.rut_jugador
       WHERE pm.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar pago de mensualidad (edición completa)
app.put('/api/pagos-mensualidades/:id', authenticate, requireAnyModule('validacion_pagos', 'admin_dashboard'), async (req, res) => {
  const {
    rut_jugador,
    rut_pagos,
    correo_apoderado,
    concepto_pago,
    cantidad_meses_pagados,
    meses_correspondientes,
    monto_total_pagado,
    comprobante_url,
    notas_tesoreria,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pagos_mensualidades 
       SET rut_jugador = $1, rut_pagos = $2, correo_apoderado = $3, concepto_pago = $4, cantidad_meses_pagados = $5,
           meses_correspondientes = $6, monto_total_pagado = $7, comprobante_url = $8, notas_tesoreria = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        rut_jugador,
        rut_pagos,
        correo_apoderado,
        concepto_pago,
        cantidad_meses_pagados,
        meses_correspondientes,
        monto_total_pagado,
        comprobante_url,
        notas_tesoreria,
        req.params.id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. ENDPOINTS: CONVOCATORIAS/CITACIONES (FASE 1)
// ==========================================

// GET: Todas las convocatorias
app.get('/api/convocatorias', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM convocatorias ORDER BY dia_partido DESC, hora_citacion ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear convocatoria
app.post('/api/convocatorias', authenticate, requireModule('citaciones'), async (req, res) => {
  const { rama, categoria, competencia, dia_partido, hora_citacion, hora_partido, lugar, entrenador } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO convocatorias 
       (rama, categoria, competencia, dia_partido, hora_citacion, hora_partido, lugar, entrenador, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activa')
       RETURNING *`,
      [rama, categoria, competencia, dia_partido, hora_citacion, hora_partido, lugar, entrenador]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 12. ENDPOINTS: EVENTOS (FASE 1)
// ==========================================

// GET: Todos los eventos
app.get('/api/eventos', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM eventos ORDER BY fecha DESC, hora ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear evento
app.post('/api/eventos', authenticate, requireModule('citaciones'), async (req, res) => {
  const { fecha, hora, titulo, lugar, descripcion } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO eventos (fecha, hora, titulo, lugar, descripcion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [fecha, hora, titulo, lugar, descripcion]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. ENDPOINTS: ASISTENCIA (FASE 1)
// ==========================================

// GET: Asistencia
app.get('/api/asistencia', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, j.nombres, j.apellido_paterno
       FROM asistencia a
       LEFT JOIN jugadores j ON a.rut_jugador = j.rut_jugador
       ORDER BY a.fecha DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Registrar asistencia
app.post('/api/asistencia', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  const { fecha, rama, categoria, rut_jugador, estado_asistencia, observacion, entrenador_cargo } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO asistencia 
       (fecha, rama, categoria, rut_jugador, estado_asistencia, observacion, entrenador_cargo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [fecha, rama, categoria, rut_jugador, estado_asistencia, observacion, entrenador_cargo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 14. ENDPOINTS: PARTIDOS EN VIVO (FASE 1)
// ==========================================

// GET: Partidos en vivo
app.get('/api/partidos-live', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM partidos_live ORDER BY fecha_hora DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Historial mesa con filtros
app.get('/api/partidos-live/historial', async (req, res) => {
  try {
    const {
      rival = '',
      torneo = '',
      rama = '',
      categoria = '',
      limit = '40',
    } = req.query || {};

    const valores = [];
    const where = [`(estado_juego ILIKE 'finalizado' OR finalizado_at IS NOT NULL)`];

    if (String(rival || '').trim()) {
      valores.push(`%${String(rival).trim()}%`);
      where.push(`equipo_visitante ILIKE $${valores.length}`);
    }
    if (String(torneo || '').trim()) {
      valores.push(`%${String(torneo).trim()}%`);
      where.push(`COALESCE(competencia_nombre, torneo_nombre, '') ILIKE $${valores.length}`);
    }
    if (String(rama || '').trim()) {
      valores.push(String(rama).trim());
      where.push(`COALESCE(rama, '') ILIKE $${valores.length}`);
    }
    if (String(categoria || '').trim()) {
      valores.push(String(categoria).trim());
      where.push(`COALESCE(categoria, '') ILIKE $${valores.length}`);
    }

    const limite = Math.min(200, Math.max(5, Number(limit) || 40));
    valores.push(limite);

    const result = await pool.query(
      `SELECT id_partido, fecha_hora, cancha_sede, rama, categoria,
              equipo_local, equipo_visitante,
              logo_local_url, logo_visitante_url,
              COALESCE(competencia_nombre, torneo_nombre) AS competencia_nombre,
              COALESCE(competencia_logo_url, torneo_logo_url) AS competencia_logo_url,
              pts_local, pts_visitante, estado_juego, iniciado_at, finalizado_at,
              mesa_payload, play_by_play_json, eventos_json, operadores_json, analisis_json,
              created_at, updated_at
       FROM partidos_live
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(finalizado_at, updated_at, fecha_hora, created_at) DESC
       LIMIT $${valores.length}`,
      valores
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear partido
app.post('/api/partidos-live', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const {
    fecha_hora, cancha_sede, categoria_rama, rama, categoria, equipo_local, equipo_visitante,
    rut_planillero, estado_juego,
    logo_local_url, logo_visitante_url, torneo_nombre, torneo_logo_url,
    pts_local, pts_visitante,
  } = req.body;
  try {
    // Use new rama/categoria if provided, otherwise use old categoria_rama for backward compatibility
    const ramafinal = rama || 'Mixta';
    const categoriafinal = categoria || 'SUB-13';
    const categoria_rama_final = categoria_rama || `${ramafinal}-${categoriafinal}`;
    
    const result = await pool.query(
      `INSERT INTO partidos_live
       (fecha_hora, cancha_sede, categoria_rama, rama, categoria, equipo_local, equipo_visitante, rut_planillero,
        estado_juego, logo_local_url, logo_visitante_url, torneo_nombre, torneo_logo_url,
        pts_local, pts_visitante)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9,'pendiente'), $10, $11, $12, $13,
        COALESCE($14, 0), COALESCE($15, 0))
       RETURNING *`,
      [
        fecha_hora, cancha_sede, categoria_rama_final, ramafinal, categoriafinal, 
        equipo_local, equipo_visitante, rut_planillero || null,
        estado_juego || 'pendiente',
        logo_local_url || null, logo_visitante_url || null,
        torneo_nombre || null, torneo_logo_url || null,
        pts_local ?? 0, pts_visitante ?? 0,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar marcador
app.put('/api/partidos-live/:id', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const {
    pts_local,
    pts_visitante,
    estado_juego,
    periodo_actual,
    fecha_hora,
    cancha_sede,
    categoria_rama,
    rama,
    categoria,
    equipo_local,
    equipo_visitante,
    logo_local_url,
    logo_visitante_url,
    torneo_nombre,
    torneo_logo_url,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE partidos_live 
       SET pts_local = COALESCE($1, pts_local),
           pts_visitante = COALESCE($2, pts_visitante),
           estado_juego = COALESCE($3, estado_juego),
           periodo_actual = COALESCE($4, periodo_actual),
           fecha_hora = COALESCE($5, fecha_hora),
           cancha_sede = COALESCE($6, cancha_sede),
           categoria_rama = COALESCE($7, categoria_rama),
           rama = COALESCE($8, rama),
           categoria = COALESCE($9, categoria),
           equipo_local = COALESCE($10, equipo_local),
           equipo_visitante = COALESCE($11, equipo_visitante),
           logo_local_url = COALESCE($12, logo_local_url),
           logo_visitante_url = COALESCE($13, logo_visitante_url),
           torneo_nombre = COALESCE($14, torneo_nombre),
           torneo_logo_url = COALESCE($15, torneo_logo_url),
           updated_at = NOW()
       WHERE id_partido = $16
       RETURNING *`,
      [
        pts_local,
        pts_visitante,
        estado_juego,
        periodo_actual,
        fecha_hora,
        cancha_sede,
        categoria_rama,
        rama,
        categoria,
        equipo_local,
        equipo_visitante,
        logo_local_url,
        logo_visitante_url,
        torneo_nombre,
        torneo_logo_url,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Finalizar partido desde mesa avanzada (persistencia historica + trazabilidad)
app.post('/api/partidos-live/:id/finalizar-mesa', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const {
    mesa_payload,
    play_by_play_json,
    eventos_json,
    operadores_json,
    analisis_json,
    competencia_nombre,
    competencia_logo_url,
    cancha_sede,
    pts_local,
    pts_visitante,
  } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE partidos_live
       SET estado_juego = 'finalizado',
           finalizado_at = COALESCE(finalizado_at, NOW()),
           iniciado_at = COALESCE(iniciado_at, NOW()),
           mesa_payload = COALESCE($1::jsonb, mesa_payload),
           play_by_play_json = COALESCE($2::jsonb, play_by_play_json),
           eventos_json = COALESCE($3::jsonb, eventos_json),
           operadores_json = COALESCE($4::jsonb, operadores_json),
           analisis_json = COALESCE($5::jsonb, analisis_json),
           competencia_nombre = COALESCE($6, competencia_nombre, torneo_nombre),
           competencia_logo_url = COALESCE($7, competencia_logo_url, torneo_logo_url),
           cancha_sede = COALESCE($8, cancha_sede),
           pts_local = COALESCE($9, pts_local),
           pts_visitante = COALESCE($10, pts_visitante),
           updated_at = NOW()
       WHERE id_partido = $11
       RETURNING *`,
      [
        mesa_payload ? JSON.stringify(mesa_payload) : null,
        play_by_play_json ? JSON.stringify(play_by_play_json) : null,
        eventos_json ? JSON.stringify(eventos_json) : null,
        operadores_json ? JSON.stringify(operadores_json) : null,
        analisis_json ? JSON.stringify(analisis_json) : null,
        competencia_nombre || null,
        competencia_logo_url || null,
        cancha_sede || null,
        pts_local ?? null,
        pts_visitante ?? null,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Eliminar un partido
app.delete('/api/partidos-live/:id', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Limpiar registros relacionados para evitar errores de llave foranea.
    await client.query(`DELETE FROM resultados WHERE id_partido = $1`, [req.params.id]);
    await client.query(`DELETE FROM estadisticas WHERE id_partido = $1`, [req.params.id]);
    await client.query(`DELETE FROM marcas_tiempo WHERE id_partido = $1`, [req.params.id]);
    await client.query(`DELETE FROM pizarra_tactica WHERE id_partido = $1`, [req.params.id]);

    const result = await client.query(
      `DELETE FROM partidos_live WHERE id_partido = $1 RETURNING id_partido`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Partido eliminado correctamente' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors and return original error.
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 15. ENDPOINTS: ESTADÍSTICAS (FASE 2)
// ==========================================

// GET: Estadísticas de un partido
app.get('/api/estadisticas/partido/:partidoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, j.nombres, j.apellido_paterno
       FROM estadisticas e
       LEFT JOIN jugadores j ON e.rut_jugador = j.rut_jugador
       WHERE e.id_partido = $1
       ORDER BY e.puntos DESC`,
      [req.params.partidoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear estadística
app.post('/api/estadisticas', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const { id_partido, rut_jugador, puntos, rebotes, asistencias, robos, tapones, faltas_cometidas, porcentaje_efectividad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO estadisticas (id_partido, rut_jugador, puntos, rebotes, asistencias, robos, tapones, faltas_cometidas, porcentaje_efectividad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id_partido, rut_jugador, puntos, rebotes, asistencias, robos, tapones, faltas_cometidas, porcentaje_efectividad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 16. ENDPOINTS: EVALUACIONES (FASE 2)
// ==========================================

// GET: Evaluaciones de un jugador
app.get('/api/evaluaciones/jugador/:rut', authenticate, requireAnyModule('evaluacion_staff', 'jugador'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM evaluaciones WHERE rut_jugador = $1 ORDER BY fecha_evaluacion DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear evaluación
app.post('/api/evaluaciones', authenticate, requireModule('evaluacion_staff'), async (req, res) => {
  const { rut_jugador, evaluador_rut, tipo_evaluacion, puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental, comentarios } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO evaluaciones (rut_jugador, evaluador_rut, fecha_evaluacion, tipo_evaluacion, puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental, comentarios)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [rut_jugador, evaluador_rut, tipo_evaluacion, puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental, comentarios]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 17. ENDPOINTS: GAMIFICACIÓN (FASE 2)
// ==========================================

// GET: Puntos de un jugador
app.get('/api/gamificacion/:rut', authenticate, requireModule('jugador'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM gamificacion_puntos WHERE rut_jugador = $1 ORDER BY fecha_logro DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear logro/puntos
app.post('/api/gamificacion', authenticate, requireAnyModule('evaluacion_staff', 'scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const { rut_jugador, tipo_logro, puntos_obtenidos, descripcion } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO gamificacion_puntos (rut_jugador, tipo_logro, puntos_obtenidos, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [rut_jugador, tipo_logro, puntos_obtenidos, descripcion]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 18. ENDPOINTS: MARCAS/RÉCORDS (FASE 2)
// ==========================================

// GET: Marcas de un jugador
app.get('/api/marcas/:rut', authenticate, requireModule('jugador'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM marcas_tiempo WHERE rut_jugador = $1 ORDER BY fecha_marca DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Registrar marca
app.post('/api/marcas', authenticate, requireAnyModule('evaluacion_staff', 'scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const { rut_jugador, categoria, tipo_marca, valor_marca, unidad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO marcas_tiempo (rut_jugador, categoria, tipo_marca, valor_marca, unidad, fecha_marca)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       RETURNING *`,
      [rut_jugador, categoria, tipo_marca, valor_marca, unidad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 19. ENDPOINTS: RESULTADOS (FASE 2)
// ==========================================

// GET: Resultado de un partido
app.get('/api/resultados/partido/:partidoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM resultados WHERE id_partido = $1`,
      [req.params.partidoId]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear resultado
app.post('/api/resultados', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const { id_partido, equipo_ganador, puntos_local, puntos_visitante, validado_por } = req.body;
  try {
    const diferencia = Math.abs(puntos_local - puntos_visitante);
    const result = await pool.query(
      `INSERT INTO resultados (id_partido, equipo_ganador, puntos_local, puntos_visitante, diferencia_puntos, validado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id_partido, equipo_ganador, puntos_local, puntos_visitante, diferencia, validado_por]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 20. ENDPOINTS: QUIZ (FASE 2)
// ==========================================

// GET: Todas las preguntas
app.get('/api/quiz', authenticate, requireModule('academia'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM quiz_preguntas WHERE activo = true ORDER BY dificultad ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pregunta
app.post('/api/quiz', authenticate, requireModule('academia'), async (req, res) => {
  const { titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO quiz_preguntas (titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [titulo, tipo_quiz, rama, pregunta, JSON.stringify(opciones_json), respuesta_correcta, dificultad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 21. ENDPOINTS: PIZARRA TÁCTICA (FASE 2)
// ==========================================

// GET: Tácticas de un partido
app.get('/api/pizarra/partido/:partidoId', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pizarra_tactica WHERE id_partido = $1 ORDER BY fecha_tactica DESC`,
      [req.params.partidoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear táctica
app.post('/api/pizarra', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const { id_partido, entrenador_rut, nombre_tactica, descripcion, formacion, zona_defensa, zona_ataque } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO pizarra_tactica (id_partido, entrenador_rut, nombre_tactica, descripcion, formacion, zona_defensa, zona_ataque)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id_partido, entrenador_rut, nombre_tactica, descripcion, formacion, zona_defensa, zona_ataque]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 22. ENDPOINTS: MIGRACIÓN PAGOS (FASE 2)
// ==========================================

// GET: Pagos migrados
app.get('/api/migracion-pagos', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM migracion_pagos ORDER BY fecha_migracion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear registro de migración
app.post('/api/migracion-pagos', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { rut_jugador, nombre_jugador, mes_pago, año_pago, monto_pago, estado_pago, metodo_pago } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO migracion_pagos (rut_jugador, nombre_jugador, mes_pago, año_pago, monto_pago, estado_pago, metodo_pago)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [rut_jugador, nombre_jugador, mes_pago, año_pago, monto_pago, estado_pago, metodo_pago]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 23. ENDPOINTS: JUGADORES VISITA (FASE 2)
// ==========================================

// GET: Jugadores en visita/prueba
app.get('/api/jugadores-visita', authenticate, requireModule('invitados'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jugadores_visita ORDER BY fecha_visita DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Registrar jugador en visita
app.post('/api/jugadores-visita', authenticate, requireModule('invitados'), async (req, res) => {
  const {
    rut_visita,
    nombres,
    apellido_paterno,
    apellido_materno,
    club_procedencia,
    rama,
    categoria,
    posicion,
    contacto_apoderado,
    telefono_contacto,
    club_logo_url,
    foto_jugador,
  } = req.body;
  try {
    const columnasVisita = await obtenerColumnasTabla('jugadores_visita');
    const columnas = ['rut_visita', 'nombres', 'apellido_paterno', 'apellido_materno', 'club_procedencia', 'rama', 'categoria', 'posicion', 'contacto_apoderado', 'telefono_contacto', 'fecha_visita'];
    const valores = [rut_visita, nombres, apellido_paterno, apellido_materno, club_procedencia, rama, categoria, posicion, contacto_apoderado, telefono_contacto];

    if (club_logo_url !== undefined && columnasVisita.has('club_logo_url')) {
      columnas.splice(columnas.length - 1, 0, 'club_logo_url');
      valores.push(club_logo_url);
    } else if (foto_jugador !== undefined && columnasVisita.has('foto_jugador')) {
      columnas.splice(columnas.length - 1, 0, 'foto_jugador');
      valores.push(foto_jugador);
    }

    const placeholders = columnas.slice(0, -1).map((_columna, indice) => `$${indice + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO jugadores_visita (${columnas.join(', ')})
       VALUES (${placeholders}, CURRENT_DATE)
       RETURNING *`,
      valores
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar resultado de prueba
app.put('/api/jugadores-visita/:id', authenticate, requireModule('invitados'), async (req, res) => {
  const { prueba_realizada, resultado_prueba, reclutado, observaciones, club_logo_url, foto_jugador } = req.body;
  try {
    const columnasVisita = await obtenerColumnasTabla('jugadores_visita');
    const sets = [
      'prueba_realizada = $1',
      'resultado_prueba = $2',
      'reclutado = $3',
      'observaciones = $4',
    ];
    const valores = [prueba_realizada, resultado_prueba, reclutado, observaciones];

    if (club_logo_url !== undefined && columnasVisita.has('club_logo_url')) {
      sets.push(`club_logo_url = $${valores.length + 1}`);
      valores.push(club_logo_url);
    } else if (foto_jugador !== undefined && columnasVisita.has('foto_jugador')) {
      sets.push(`foto_jugador = $${valores.length + 1}`);
      valores.push(foto_jugador);
    }

    sets.push(`updated_at = NOW()`);
    valores.push(req.params.id);

    const result = await pool.query(
      `UPDATE jugadores_visita 
       SET ${sets.join(', ')}
       WHERE id_visita = $${valores.length}
       RETURNING *`,
      valores
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 24. ENDPOINTS: AUDITORIA (FASE 3)
// ==========================================

app.get('/api/auditoria', authenticate, requireModule('auditoria'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM auditoria ORDER BY fecha_accion DESC LIMIT 100`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 25. ENDPOINTS: STAFF (FASE 3)
// ==========================================

app.get('/api/staff', authenticate, requireAnyModule('admin_dashboard', 'asistencia_staff'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM staff WHERE activo = true ORDER BY apellido_paterno ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { rut_staff, nombres, apellido_paterno, apellido_materno, cargo, rama, email, telefono } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO staff (rut_staff, nombres, apellido_paterno, apellido_materno, cargo, rama, email, telefono, fecha_ingreso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
       RETURNING *`,
      [rut_staff, nombres, apellido_paterno, apellido_materno, cargo, rama, email, telefono]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 26. ENDPOINTS: TORNEOS (FASE 3)
// ==========================================

app.get('/api/torneos', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM torneos ORDER BY fecha_inicio DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/torneos', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO torneos (nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activo')
       RETURNING *`,
      [nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 27. ENDPOINTS: CAJA EVENTO (FASE 3)
// ==========================================

app.get('/api/caja-evento/:eventoId', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM caja_evento_kiosco WHERE id_evento = $1 ORDER BY fecha_movimiento DESC`,
      [req.params.eventoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/caja-evento', authenticate, requireModule('kiosco'), async (req, res) => {
  const { id_evento, tipo_movimiento, concepto, monto_ingreso, monto_egreso, metodo_pago, responsable } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO caja_evento_kiosco (id_evento, tipo_movimiento, concepto, monto_ingreso, monto_egreso, metodo_pago, responsable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id_evento, tipo_movimiento, concepto, monto_ingreso || 0, monto_egreso || 0, metodo_pago, responsable]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 28. ENDPOINTS: INVENTARIO (FASE 3)
// ==========================================

app.get('/api/inventario', authenticate, requireAnyModule('kiosco', 'inventario'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM catalogo_inventario ORDER BY nombre_articulo ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventario', authenticate, requireAnyModule('kiosco', 'inventario'), async (req, res) => {
  const { codigo_articulo, nombre_articulo, categoria, cantidad_total, precio_unitario, ubicacion, proveedor } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO catalogo_inventario (codigo_articulo, nombre_articulo, categoria, cantidad_total, cantidad_disponible, precio_unitario, fecha_ingreso, ubicacion, proveedor)
       VALUES ($1, $2, $3, $4, $4, $5, CURRENT_DATE, $6, $7)
       RETURNING *`,
      [codigo_articulo, nombre_articulo, categoria, cantidad_total, precio_unitario, ubicacion, proveedor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 29. ENDPOINTS: EGRESOS (FASE 3)
// ==========================================

app.get('/api/egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM egresos ORDER BY fecha_egreso DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { concepto, categoria, monto_egreso, responsable, observaciones } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO egresos (fecha_egreso, concepto, categoria, monto_egreso, responsable, estado, observaciones)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, 'pendiente', $5)
       RETURNING *`,
      [concepto, categoria, monto_egreso, responsable, observaciones]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 29B. ENDPOINTS: KIOSCO POS (persistencia real de turnos/ventas/fiados)
// ==========================================

app.get('/api/kiosco-productos', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM kiosco_productos WHERE activo = true ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kiosco-productos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { nombre, emoji, categoria, costo, precio, stock } = req.body;
  if (!nombre || precio == null) {
    return res.status(400).json({ error: 'Nombre y precio son obligatorios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO kiosco_productos (nombre, emoji, categoria, costo, precio, stock)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, emoji || '📦', categoria || 'General', costo || 0, precio, stock || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/kiosco-productos/:id', authenticate, requireModule('kiosco'), async (req, res) => {
  const camposPermitidos = ['nombre', 'emoji', 'categoria', 'costo', 'precio', 'stock', 'activo'];
  const columnas = [];
  const valores = [];
  camposPermitidos.forEach((campo) => {
    if (req.body[campo] !== undefined) {
      columnas.push(`${campo} = $${columnas.length + 1}`);
      valores.push(req.body[campo]);
    }
  });
  if (columnas.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar.' });
  }
  valores.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE kiosco_productos SET ${columnas.join(', ')}, updated_at = NOW() WHERE id = $${valores.length} RETURNING *`,
      valores
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/kiosco-turnos/actual', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM kiosco_turnos WHERE estado = 'abierto' ORDER BY fecha_apertura DESC LIMIT 1`
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/kiosco-turnos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { desde, hasta, estado } = req.query;
  try {
    const condiciones = [];
    const valores = [];
    if (estado) {
      valores.push(estado);
      condiciones.push(`estado = $${valores.length}`);
    }
    if (desde) {
      valores.push(desde);
      condiciones.push(`dia >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(hasta);
      condiciones.push(`dia <= $${valores.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM kiosco_turnos ${where} ORDER BY fecha_apertura DESC LIMIT 200`,
      valores
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kiosco-turnos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { responsable, dia, monto_inicial } = req.body;
  if (!responsable || !dia) {
    return res.status(400).json({ error: 'Responsable y día son obligatorios.' });
  }
  try {
    const abierto = await pool.query(`SELECT id FROM kiosco_turnos WHERE estado = 'abierto' LIMIT 1`);
    if (abierto.rows.length > 0) {
      return res.status(409).json({ error: 'Ya hay un turno abierto. Ciérralo antes de abrir uno nuevo.' });
    }
    const result = await pool.query(
      `INSERT INTO kiosco_turnos (responsable, dia, monto_inicial, estado)
       VALUES ($1, $2, $3, 'abierto')
       RETURNING *`,
      [responsable, dia, monto_inicial || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/kiosco-turnos/:id/cerrar', authenticate, requireModule('kiosco'), async (req, res) => {
  const {
    total_efectivo_ventas,
    total_transferencia_ventas,
    total_egresos,
    total_pendientes,
    caja_neta_final,
    firma_base64,
    cerrado_por,
    ticket_final,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE kiosco_turnos SET
         estado = 'cerrado',
         fecha_cierre = NOW(),
         total_efectivo_ventas = $1,
         total_transferencia_ventas = $2,
         total_egresos = $3,
         total_pendientes = $4,
         caja_neta_final = $5,
         firma_base64 = $6,
         cerrado_por = $7,
         ticket_final = $8
       WHERE id = $9 AND estado = 'abierto'
       RETURNING *`,
      [
        total_efectivo_ventas || 0,
        total_transferencia_ventas || 0,
        total_egresos || 0,
        total_pendientes || 0,
        caja_neta_final || 0,
        firma_base64 || null,
        cerrado_por || null,
        ticket_final || 0,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado o ya estaba cerrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/kiosco-ventas', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id, desde, hasta } = req.query;
  try {
    const condiciones = [];
    const valores = [];
    if (turno_id) {
      valores.push(turno_id);
      condiciones.push(`turno_id = $${valores.length}`);
    }
    if (desde) {
      valores.push(desde);
      condiciones.push(`fecha >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(`${hasta} 23:59:59`);
      condiciones.push(`fecha <= $${valores.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM kiosco_ventas ${where} ORDER BY fecha DESC LIMIT 2000`,
      valores
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kiosco-ventas', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id, ticket_numero, producto_id, producto_nombre, cantidad, precio_unitario, subtotal, metodo_pago } = req.body;
  if (!producto_nombre || !cantidad || !metodo_pago) {
    return res.status(400).json({ error: 'Producto, cantidad y método de pago son obligatorios.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (producto_id) {
      const stockActual = await client.query('SELECT stock FROM kiosco_productos WHERE id = $1 FOR UPDATE', [producto_id]);
      const stockDisponible = Number(stockActual.rows[0]?.stock ?? 0);
      if (stockActual.rows.length > 0 && stockDisponible < cantidad) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Stock insuficiente: quedan ${stockDisponible} unidades.` });
      }
      await client.query('UPDATE kiosco_productos SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id = $2', [cantidad, producto_id]);
    }

    const venta = await client.query(
      `INSERT INTO kiosco_ventas (turno_id, ticket_numero, producto_id, producto_nombre, cantidad, precio_unitario, subtotal, metodo_pago)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [turno_id || null, ticket_numero || null, producto_id || null, producto_nombre, cantidad, precio_unitario || 0, subtotal || 0, metodo_pago]
    );

    await client.query('COMMIT');
    res.json(venta.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/kiosco-ventas', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    await pool.query('DELETE FROM kiosco_ventas');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/kiosco-fiados', authenticate, requireModule('kiosco'), async (req, res) => {
  const { estado } = req.query;
  try {
    const where = estado ? `WHERE estado = $1` : '';
    const result = await pool.query(
      `SELECT * FROM kiosco_fiados ${where} ORDER BY fecha_ultimo_movimiento DESC LIMIT 500`,
      estado ? [estado] : []
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kiosco-fiados/cargo', authenticate, requireModule('kiosco'), async (req, res) => {
  const { fiado_id, nombre, detalle, monto, turno_id, ticket_numero } = req.body;
  if (!monto || Number(monto) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let fiado;

    if (fiado_id) {
      const actualizado = await client.query(
        `UPDATE kiosco_fiados SET monto_total = monto_total + $1, estado = 'abierto', fecha_ultimo_movimiento = NOW()
         WHERE id = $2 RETURNING *`,
        [monto, fiado_id]
      );
      if (actualizado.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Cuenta pendiente no encontrada.' });
      }
      fiado = actualizado.rows[0];
    } else {
      if (!nombre) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El nombre es obligatorio para una cuenta nueva.' });
      }
      const creado = await client.query(
        `INSERT INTO kiosco_fiados (nombre, detalle, monto_total, estado)
         VALUES ($1, $2, $3, 'abierto')
         RETURNING *`,
        [nombre, detalle || '', monto]
      );
      fiado = creado.rows[0];
    }

    await client.query(
      `INSERT INTO kiosco_fiados_movimientos (fiado_id, tipo, monto, turno_id, ticket_numero)
       VALUES ($1, 'cargo', $2, $3, $4)`,
      [fiado.id, monto, turno_id || null, ticket_numero || null]
    );

    await client.query('COMMIT');
    res.json(fiado);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/kiosco-fiados/:id/pago', authenticate, requireModule('kiosco'), async (req, res) => {
  const { monto, metodo_pago, turno_id } = req.body;
  if (!monto || Number(monto) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const actual = await client.query('SELECT * FROM kiosco_fiados WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (actual.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta pendiente no encontrada.' });
    }
    const nuevoMonto = Math.max(0, Number(actual.rows[0].monto_total) - Number(monto));
    const actualizado = await client.query(
      `UPDATE kiosco_fiados SET monto_total = $1, estado = $2, fecha_ultimo_movimiento = NOW()
       WHERE id = $3 RETURNING *`,
      [nuevoMonto, nuevoMonto <= 0 ? 'pagado' : 'abierto', req.params.id]
    );

    await client.query(
      `INSERT INTO kiosco_fiados_movimientos (fiado_id, tipo, monto, metodo_pago, turno_id)
       VALUES ($1, 'pago', $2, $3, $4)`,
      [req.params.id, monto, metodo_pago || 'efectivo', turno_id || null]
    );

    await client.query('COMMIT');
    res.json(actualizado.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/kiosco-egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id } = req.query;
  try {
    const where = turno_id ? `WHERE turno_id = $1` : '';
    const result = await pool.query(
      `SELECT * FROM kiosco_egresos ${where} ORDER BY fecha DESC LIMIT 500`,
      turno_id ? [turno_id] : []
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kiosco-egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id, descripcion, monto } = req.body;
  if (!descripcion || !monto) {
    return res.status(400).json({ error: 'Descripción y monto son obligatorios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO kiosco_egresos (turno_id, descripcion, monto)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [turno_id || null, descripcion, monto]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 30. ENDPOINTS: CLUBES (FASE 3)
// ==========================================

app.get('/api/clubes', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM clubes WHERE activo = true ORDER BY nombre_club ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clubes', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const { nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO clubes (nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club, fecha_registro)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       RETURNING *`,
      [nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 31. ENDPOINTS: LESIONES (FASE 3)
// ==========================================

app.get('/api/lesiones', authenticate, requireAnyModule('evaluacion_staff', 'asistencia_staff'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, j.nombres, j.apellido_paterno
       FROM lesiones l
       LEFT JOIN jugadores j ON l.rut_jugador = j.rut_jugador
       ORDER BY l.fecha_lesion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lesiones', authenticate, requireAnyModule('evaluacion_staff', 'asistencia_staff'), async (req, res) => {
  const { rut_jugador, tipo_lesion, descripcion, fecha_recuperacion_estimada, medico_tratante } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO lesiones (rut_jugador, tipo_lesion, descripcion, fecha_lesion, fecha_recuperacion_estimada, medico_tratante, estado_lesion)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'activa')
       RETURNING *`,
      [rut_jugador, tipo_lesion, descripcion, fecha_recuperacion_estimada, medico_tratante]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 32. ENDPOINTS: DISCIPLINA (FASE 3)
// ==========================================

app.get('/api/disciplina', authenticate, requireAnyModule('evaluacion_staff', 'asistencia_staff'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, j.nombres, j.apellido_paterno
       FROM disciplina d
       LEFT JOIN jugadores j ON d.rut_jugador = j.rut_jugador
       ORDER BY d.fecha_sancion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/disciplina', authenticate, requireAnyModule('evaluacion_staff', 'asistencia_staff'), async (req, res) => {
  const { rut_jugador, tipo_sancion, razon_sancion, duracion_dias, multa_aplicada, aplicada_por } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO disciplina (rut_jugador, tipo_sancion, razon_sancion, fecha_sancion, duracion_dias, multa_aplicada, aplicada_por, estado)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, 'activa')
       RETURNING *`,
      [rut_jugador, tipo_sancion, razon_sancion, duracion_dias, multa_aplicada || 0, aplicada_por]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 33. ENDPOINTS: ENTRENAMIENTOS (FASE 3)
// ==========================================

app.get('/api/entrenamientos', authenticate, requireAnyModule('asistencia_staff', 'evaluacion_staff', 'academia'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM entrenamientos ORDER BY fecha_entrenamiento DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entrenamientos', authenticate, requireAnyModule('asistencia_staff', 'evaluacion_staff'), async (req, res) => {
  const { rama, categoria, fecha_entrenamiento, hora_inicio, hora_fin, lugar, entrenador_a_cargo, tema_entrenamiento, capacidad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO entrenamientos (rama, categoria, fecha_entrenamiento, hora_inicio, hora_fin, lugar, entrenador_a_cargo, tema_entrenamiento, capacidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [rama, categoria, fecha_entrenamiento, hora_inicio, hora_fin, lugar, entrenador_a_cargo, tema_entrenamiento, capacidad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 34. ENDPOINTS: ENCUESTAS RESPUESTAS (FASE 3)
// ==========================================

app.get('/api/encuestas/:encuestaId/respuestas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM encuestas_respuestas WHERE id_encuesta = $1 ORDER BY fecha_respuesta DESC`,
      [req.params.encuestaId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/encuestas/:encuestaId/respuesta', authenticate, requireModule('comunicaciones'), async (req, res) => {
  const { rut_respondente, opcion_seleccionada, comentario_adicional } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO encuestas_respuestas (id_encuesta, rut_respondente, opcion_seleccionada, comentario_adicional)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.encuestaId, rut_respondente, opcion_seleccionada, comentario_adicional]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 35. ENDPOINTS: ASISTENCIA EVENTOS DETALLE (FASE 3)
// ==========================================

app.get('/api/asistencia-eventos/:eventoId', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM asistencia_eventos_detalle WHERE id_evento = $1 ORDER BY fecha_confirmacion DESC`,
      [req.params.eventoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/asistencia-eventos', authenticate, requireModule('citaciones'), async (req, res) => {
  const { id_evento, rut_persona, tipo_persona, estado_confirmacion, transporte_requerido } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO asistencia_eventos_detalle (id_evento, rut_persona, tipo_persona, estado_confirmacion, transporte_requerido, fecha_confirmacion)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [id_evento, rut_persona, tipo_persona, estado_confirmacion, transporte_requerido || false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️  Base de datos: ${process.env.DATABASE_URL ? 'Conectada ✓' : 'No configurada ✗'}\n`);

  ensureCuentasExtendedColumns().catch((error) => {
    console.error('❌ Error verificando columnas extendidas de cuentas:', error.message);
  });

  ensurePartidosLiveCoreColumns().catch((error) => {
    console.error('❌ Error verificando columnas base partidos_live:', error.message);
  });

  ensurePartidosLiveMesaColumns().catch((error) => {
    console.error('❌ Error verificando columnas avanzadas de mesa:', error.message);
  });

  ensurePartidosLiveLogos().catch((error) => {
    console.error('❌ Error verificando columnas de logos partidos_live:', error.message);
  });

  ensurePagosMensualidadesColumns().catch((error) => {
    console.error('❌ Error verificando columnas pagos_mensualidades:', error.message);
  });

  ensureLogoAssetsTable().catch((error) => {
    console.error('❌ Error verificando tabla logo_assets:', error.message);
  });

  ensureKioscoTables().catch((error) => {
    console.error('❌ Error verificando tablas de kiosco:', error.message);
  });

  ensureSuperAdminAccount().catch((error) => {
    console.error('❌ Error asegurando super admin:', error.message);
  });

  scheduleAutomaticBackups();
});

module.exports = app;
