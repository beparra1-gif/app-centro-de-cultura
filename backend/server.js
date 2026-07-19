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
  authenticateOpcional,
  requireRole,
  requireModule,
  requireAnyModule,
  requireOwnerIdOrModule,
  requireApoderadoDeJugadorOModule,
  requireApoderadoDeJugador,
  stripFieldsUnlessModule,
  normalizarRutParaComparar,
  setPool,
  resolverPermisosDeActor,
} = require('./security/auth');
const { obtenerPermisosEfectivos, normalizarRol } = require('./security/accessControl');

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

// Videos "cortos" subidos directo por el profesor (sin depender de un link de
// YouTube). Límite bajo a propósito — el pedido explícito fue que esto no
// recargue la app, así que no se acepta cualquier tamaño de archivo.
const uploadVideoMemoria = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const permitido = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!permitido.includes(file.mimetype)) {
      cb(new Error('Formato de video no permitido. Usa MP4, WEBM o MOV.'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 },
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
    console.error('[GET /api/assets/logos/list]', error);
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
    console.error('[DELETE /api/assets/logos/:filename]', error);
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

setPool(pool);

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

// Diseño de marco cosmético de la tarjeta coleccionable, elegido libremente
// por el jugador/apoderado — independiente de la rareza por nivel (que sigue
// reflejando progresión). No es un campo administrativo: no va en
// CAMPOS_JUGADOR_SOLO_ADMIN, así que el apoderado dueño ya puede guardarlo
// a través del PUT /api/jugadores/:rut existente.
const ensureJugadoresExtendedColumns = async () => {
  await pool.query(`ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS diseno_marco VARCHAR(20) DEFAULT 'clasico'`);
  console.log('🎴 Columna diseno_marco de jugadores verificada');
};

// beca empezó como BOOLEAN (sí/no) pero el club maneja porcentajes de rebaja
// (hasta 100%) — se migra una sola vez a NUMERIC. El USING solo tiene sentido
// mientras la columna sigue siendo boolean, así que se guarda contra
// information_schema para no re-ejecutarlo (y romper) en bootes siguientes.
const ensureJugadoresBecaNumerica = async () => {
  const tipoActual = await pool.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name = 'jugadores' AND column_name = 'beca'`
  );
  if (tipoActual.rows[0]?.data_type === 'boolean') {
    // El DEFAULT false debe sacarse antes del cambio de tipo: Postgres intenta
    // convertir el default existente al tipo nuevo automáticamente y "false"
    // no es un literal numeric válido.
    await pool.query(`ALTER TABLE jugadores ALTER COLUMN beca DROP DEFAULT`);
    await pool.query(
      `ALTER TABLE jugadores ALTER COLUMN beca TYPE NUMERIC(5,2)
       USING (CASE WHEN beca = true THEN 100 WHEN beca = false THEN 0 ELSE NULL END)`
    );
    console.log('🎓 Columna beca migrada de booleano a porcentaje (NUMERIC)');
  }
  await pool.query(`ALTER TABLE jugadores ALTER COLUMN beca SET DEFAULT 0`);
};

// Trazabilidad mensual de revisión de becas: una fila por jugador becado por
// mes confirma que el admin/superadmin designado validó que la beca sigue
// vigente ese mes. Ausencia de fila para el mes actual = pendiente de revisar.
const ensureBecaRevisionesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS beca_revisiones (
      id SERIAL PRIMARY KEY,
      rut_jugador VARCHAR(20) NOT NULL,
      mes VARCHAR(7) NOT NULL,
      porcentaje NUMERIC(5,2) NOT NULL,
      revisado_por VARCHAR(20),
      revisado_en TIMESTAMP DEFAULT NOW(),
      UNIQUE(rut_jugador, mes)
    )
  `);
  console.log('🎓 Tabla beca_revisiones verificada');
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

// El post que anuncia una citación en el Muro (comunicaciones) solo vivía en
// el estado local del navegador que la creaba: un apoderado en otra sesión
// nunca llegaba a ver la tarjeta de confirmar/rechazar. Estas columnas le dan
// persistencia real al vínculo comunicación ↔ citación.
const ensureComunicacionesExtendedColumns = async () => {
  const ddl = [
    // Sin FK: ensureCitacionesTables/ensureComunicacionesExtendedColumns corren
    // en paralelo en el arranque (no están encadenadas), así que una referencia
    // a citaciones(id) podría fallar por orden de ejecución.
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS citacion_id INTEGER`,
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS convocatoria_ruts JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS convocatoria_alertas_morosidad JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS responsable_nombre VARCHAR(255)`,
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS responsable_rol VARCHAR(50)`,
    // Material de Academia llegaba a todos sin distinción de rama/categoría.
    // Este arreglo guarda a qué categoría(s) específicas va dirigido un
    // material (independiente del campo "categoria" singular ya usado por
    // otras comunicaciones); vacío = visible para todas (comportamiento igual al anterior).
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS categorias_objetivo JSONB DEFAULT '[]'::jsonb`,
    // creado_por: RUT de quien publicó, seteado por el servidor (nunca por el
    // cliente) — habilita el panel "Mis Publicaciones" de Academia y el
    // chequeo de dueño en PUT/DELETE.
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS creado_por VARCHAR(255)`,
    // academia_video_id: enlaza la comunicación autogenerada al subir un
    // video con su fila real en academia_videos (sin FK, mismo estilo que
    // citacion_id de arriba), para poder editar/borrar ambas juntas y para
    // que el frontend distinga "video subido" de "link externo" sin adivinar por tipo.
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS academia_video_id INTEGER`,
    // activo: publicado/despublicado. Todo lo existente queda publicado (true).
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log('🧩 Columnas extendidas de comunicaciones verificadas');
};

// El módulo de Lista (StaffAsistenciaPanel) no guardaba nada realmente: el
// botón "Confirmar y Guardar" solo mostraba un toast. sesion_id agrupa todas
// las filas de una misma pasada de lista (una fecha/rama/categoría/entrenador)
// para poder listarla, editarla o borrarla como unidad en el historial.
const ensureAsistenciaExtendedColumns = async () => {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS asistencia (
      id_asistencia SERIAL PRIMARY KEY,
      fecha DATE,
      rama VARCHAR(50),
      categoria VARCHAR(50),
      rut_jugador VARCHAR(20),
      estado_asistencia VARCHAR(50),
      observacion TEXT,
      entrenador_cargo VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS sesion_id VARCHAR(50)`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS hora_inicio VARCHAR(5)`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS hora_fin VARCHAR(5)`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS nombre_jugador VARCHAR(255)`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `CREATE INDEX IF NOT EXISTS idx_asistencia_sesion ON asistencia (sesion_id)`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log('🧩 Columnas extendidas de asistencia verificadas');
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
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS id_torneo INT`,
    // Permite cargar un partido (para que cuente en la tabla de posiciones)
    // sin que aparezca en el muro público de "Últimos Resultados" — pensado
    // para partidos de terceros de un torneo externo que se cargan solo por
    // completitud de la tabla, no como noticia del club.
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS publicado BOOLEAN DEFAULT true`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }

  console.log('📋 Columnas avanzadas de mesa en partidos_live verificadas');
};

// torneos solo vivía en el script de migración suelto (backend/migrations/init.js)
// — si un despliegue nunca lo corrió, la tabla no existía y la tabla de
// posiciones/el selector de torneo fallaban con "relation torneos does not exist".
const ensureTorneosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS torneos (
      id_torneo SERIAL PRIMARY KEY,
      nombre_torneo VARCHAR(255),
      rama VARCHAR(50),
      categoria VARCHAR(50),
      fecha_inicio DATE,
      fecha_fin DATE,
      ubicacion VARCHAR(255),
      organizador VARCHAR(255),
      cantidad_equipos INT,
      formato VARCHAR(50),
      estado VARCHAR(50),
      ganador VARCHAR(255),
      subcampeón VARCHAR(255),
      premios TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('🏆 Tabla torneos verificada');
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

const ensureAcademiaVideosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academia_videos (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      filename VARCHAR(255) UNIQUE NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_data BYTEA NOT NULL,
      tamano_bytes INTEGER,
      subido_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE academia_videos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true`);
  console.log('🎬 Tabla academia_videos verificada');
};

// pizarra_tactica ya existía pero atada a id_partido (anotaciones de un
// partido en vivo, módulo scoreboard_live) — no servía para material
// docente general. academia_pizarras es la versión desacoplada: una
// captura de la pizarra (cancha + fichas + trazos) más metadata, dirigida
// a una rama/categoría como el resto del material de Academia.
const ensureAcademiaPizarrasTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academia_pizarras (
      id SERIAL PRIMARY KEY,
      nombre_tactica VARCHAR(255) NOT NULL,
      descripcion TEXT,
      imagen_filename VARCHAR(255) UNIQUE,
      imagen_mime_type VARCHAR(100),
      imagen_data BYTEA,
      rama VARCHAR(50),
      categorias_objetivo JSONB DEFAULT '[]'::jsonb,
      creado_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE academia_pizarras ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true`);
  console.log('🏀 Tabla academia_pizarras verificada');
};

// quiz_preguntas se creó en migrations/init.js sin dueño ni targeting
// multi-categoría (solo una "categoria" singular, nunca usada por el
// formulario de creación). Se deja esa columna vieja intacta y se agrega
// categorias_objetivo (mismo criterio que materiales/pizarras) + creado_por.
const ensureQuizExtendedColumns = async () => {
  await pool.query(`ALTER TABLE quiz_preguntas ADD COLUMN IF NOT EXISTS creado_por VARCHAR(255)`);
  await pool.query(`ALTER TABLE quiz_preguntas ADD COLUMN IF NOT EXISTS categorias_objetivo JSONB DEFAULT '[]'::jsonb`);
  console.log('🧠 Columnas extendidas de quiz_preguntas verificadas');
};

// gamificacion_puntos solo existía en migrations/init.js (script suelto, no se
// corre solo al arrancar) — el dashboard de Academia y el ranking dependen de
// que esta tabla exista siempre, así que se agrega acá con el mismo DDL.
// Igual que gamificacion_puntos, esta tabla solo vivía en el script de
// migración suelto (backend/migrations/init.js) — si un despliegue nunca lo
// corrió, quedaba inexistente. La copiamos acá para que el boot la garantice.
const ensureEvaluacionesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evaluaciones (
      id_evaluacion SERIAL PRIMARY KEY,
      rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
      evaluador_rut VARCHAR(20),
      fecha_evaluacion DATE,
      tipo_evaluacion VARCHAR(50),
      puntaje_tecnica INT,
      puntaje_actitud INT,
      puntaje_condicion INT,
      puntaje_mental INT,
      comentarios TEXT,
      recomendaciones TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('📋 Tabla evaluaciones verificada');
};

const ensureGamificacionPuntosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamificacion_puntos (
      id_logro SERIAL PRIMARY KEY,
      rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
      tipo_logro VARCHAR(100),
      puntos_obtenidos INT,
      descripcion TEXT,
      fecha_logro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      validado BOOLEAN DEFAULT false,
      validador_rut VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('🏆 Tabla gamificacion_puntos verificada');
};

// Registro real de respuestas de quiz (antes solo se guardaba un punto de
// gamificación cuando la respuesta era correcta, sin decir a qué pregunta
// correspondía, y nada impedía "re-responder" tras refrescar la página).
// UNIQUE(id_pregunta, rut_jugador) hace todo upsert-seguro vía ON CONFLICT.
const ensureQuizRespuestasTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_respuestas (
      id SERIAL PRIMARY KEY,
      id_pregunta INTEGER NOT NULL REFERENCES quiz_preguntas(id_pregunta) ON DELETE CASCADE,
      rut_jugador VARCHAR(20) NOT NULL REFERENCES jugadores(rut_jugador),
      opcion_seleccionada VARCHAR(10) NOT NULL,
      es_correcta BOOLEAN NOT NULL,
      puntos_obtenidos INT NOT NULL DEFAULT 0,
      respondido_por VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id_pregunta, rut_jugador)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quiz_respuestas_pregunta ON quiz_respuestas (id_pregunta)`);
  console.log('📝 Tabla quiz_respuestas verificada');
};

// Registro de qué deportista abrió/reprodujo cada material de Academia, para
// medir alcance real (quién interactuó vs. quién nunca lo vio).
const ensureAcademiaInteraccionesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academia_material_interacciones (
      id SERIAL PRIMARY KEY,
      comunicacion_id INTEGER NOT NULL REFERENCES comunicaciones(id) ON DELETE CASCADE,
      rut_jugador VARCHAR(20) NOT NULL REFERENCES jugadores(rut_jugador),
      primera_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(comunicacion_id, rut_jugador)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_academia_material_interacciones_com ON academia_material_interacciones (comunicacion_id)`);
  console.log('👁️ Tabla academia_material_interacciones verificada');
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
      nombre_receptor VARCHAR(120),
      apellido_receptor VARCHAR(120),
      rut_receptor VARCHAR(20),
      firma_receptor TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE kiosco_egresos ADD COLUMN IF NOT EXISTS nombre_receptor VARCHAR(120)`);
  await pool.query(`ALTER TABLE kiosco_egresos ADD COLUMN IF NOT EXISTS apellido_receptor VARCHAR(120)`);
  await pool.query(`ALTER TABLE kiosco_egresos ADD COLUMN IF NOT EXISTS rut_receptor VARCHAR(20)`);
  await pool.query(`ALTER TABLE kiosco_egresos ADD COLUMN IF NOT EXISTS firma_receptor TEXT`);

  console.log('🛒 Tablas de kiosco POS verificadas');
};

// Citaciones: el flujo vivía 100% en memoria del navegador (nominaCita en
// App.jsx), por lo que las convocatorias y las respuestas de los apoderados
// se perdían al recargar. Estas tablas le dan persistencia real: la citación
// en sí y, por cada convocado, su fila propia con el estado de respuesta.
const ensureCitacionesTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS citaciones (
      id SERIAL PRIMARY KEY,
      tipo_competencia VARCHAR(50),
      competencia_nombre VARCHAR(255) NOT NULL,
      competencia_logo_url VARCHAR(255),
      dia_citacion DATE,
      hora_citacion TIME,
      hora_presentacion TIME,
      rival_nombre VARCHAR(255) NOT NULL,
      rival_logo_url VARCHAR(255),
      rama VARCHAR(50),
      categoria_base VARCHAR(50),
      categorias_apoyo JSONB DEFAULT '[]'::jsonb,
      responsable_nombre VARCHAR(255),
      responsable_rut VARCHAR(20),
      responsable_correo VARCHAR(255),
      responsable_rol VARCHAR(50),
      estado VARCHAR(20) NOT NULL DEFAULT 'activa',
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS citacion_convocados (
      id SERIAL PRIMARY KEY,
      citacion_id INTEGER NOT NULL REFERENCES citaciones(id) ON DELETE CASCADE,
      rut_jugador VARCHAR(20) NOT NULL,
      nombre VARCHAR(255),
      rama VARCHAR(50),
      categoria VARCHAR(50),
      correo_apoderado VARCHAR(255),
      respuesta VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      justificacion TEXT,
      mensaje_profesor TEXT,
      requiere_excepcion_morosidad BOOLEAN DEFAULT false,
      excepcion_solicitada BOOLEAN DEFAULT false,
      estado_excepcion VARCHAR(20) DEFAULT 'no_requiere',
      actualizado_en TIMESTAMP,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(citacion_id, rut_jugador)
    )
  `);

  // hora_maxima_confirmacion: fecha+hora libre (no necesariamente el mismo
  // dia_citacion, ej. "10pm del día anterior") a partir de la cual un
  // convocado 'pendiente' se marca 'no' automáticamente (ver barrerCitacionesVencidas).
  await pool.query(`ALTER TABLE citaciones ADD COLUMN IF NOT EXISTS hora_maxima_confirmacion TIMESTAMP`);
  // Distingue un rechazo real del apoderado (siempre con justificación) de
  // uno generado por el barrido de vencimiento (sin justificación), para el
  // desglose "confirmó / rechazó justificando / rechazó por no responder".
  await pool.query(`ALTER TABLE citacion_convocados ADD COLUMN IF NOT EXISTS respondido_automaticamente BOOLEAN NOT NULL DEFAULT false`);

  console.log('📋 Tablas de citaciones verificadas');
};

// Notificaciones in-app reales, dirigidas por RUT (cuentas y jugadores comparten
// el mismo espacio de RUT), para reemplazar el aviso puramente en memoria que
// solo se veía en la pestaña donde se creó la citación.
const ensureNotificacionesAppTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificaciones_app (
      id SERIAL PRIMARY KEY,
      rut_destinatario VARCHAR(20) NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      titulo VARCHAR(255),
      cuerpo TEXT,
      referencia_tipo VARCHAR(50),
      referencia_id INTEGER,
      leida BOOLEAN DEFAULT false,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notificaciones_app_rut ON notificaciones_app (rut_destinatario, creado_en DESC)`);

  console.log('🔔 Tabla notificaciones_app verificada');
};

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
app.post('/api/logo-assets', authenticate, uploadLogoMemoria.single('archivo'), (req, res, next) => {
  const tipo = String(req.body.tipo || 'logo').trim() || 'logo';
  if (TIPOS_LOGO_ASSET_AUTOSERVICIO.includes(tipo)) {
    // El nombre lo fija el servidor a partir del actor autenticado, no el
    // valor que mande el cliente — si no, cualquiera podría forjar el
    // "nombre" y pisar la foto de perfil o el comprobante de OTRA persona
    // (el filename final sale de nombre+tipo y el INSERT hace upsert por
    // filename). El comprobante además lleva timestamp: cada envío es un
    // archivo nuevo, para no pisar el comprobante de un pago anterior
    // todavía en revisión.
    const rutActor = String(req.actor?.rut || 'sin-rut').trim();
    req.body.nombre = tipo === 'comprobante' ? `${rutActor}-${Date.now()}` : rutActor;
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
    console.error('[POST /api/logo-assets]', error);
    return res.status(500).json({ error: error.message || 'No se pudo subir el logo.' });
  }
});

// Tipos que NO son logos de equipo/torneo pero comparten esta misma tabla
// (foto de perfil de onboarding, comprobante de pago, foto de jugador desde
// el panel admin o desde /api/jugadores/:rut/foto) — se excluyen del listado
// para no entorpecer la búsqueda de logos reales.
const TIPOS_LOGO_ASSET_NO_LISTABLES = ['perfil', 'comprobante', 'jugador-foto', 'foto-jugador'];

app.get('/api/logo-assets/list', async (_req, res) => {
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
    console.error('[GET /api/logo-assets/file/:filename]', error);
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
    console.error('[DELETE /api/logo-assets/:filename]', error);
    return res.status(500).json({ error: error.message || 'No se pudo borrar el logo.' });
  }
});

// POST: sube un video corto y de paso crea la comunicación "Academia-Video"
// que lo hace aparecer en el mismo listado que el material por enlace.
app.post('/api/academia-videos', authenticate, requireRole('staff', 'admin', 'super_admin'), uploadVideoMemoria.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar un archivo de video.' });
    }
    const titulo = String(req.body.titulo || '').trim();
    if (!titulo) {
      return res.status(400).json({ error: 'Falta el título del video.' });
    }

    const extension = path.extname(req.file.originalname).toLowerCase() || '.mp4';
    const slug = String(titulo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'video';
    const filename = `${slug}-${Date.now()}${extension}`;

    const inserted = await pool.query(
      `INSERT INTO academia_videos (titulo, filename, mime_type, file_data, tamano_bytes, subido_por)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, titulo, filename, tamano_bytes, created_at`,
      [titulo, filename, req.file.mimetype, req.file.buffer, req.file.size, req.actor.rut]
    );
    const video = inserted.rows[0];
    // Ruta relativa a la raíz de la API (sin protocolo/host ni prefijo /api):
    // el frontend la resuelve contra su propio API_BASE_URL_CONFIG, que en dev
    // apunta a un puerto distinto (3000) del de Vite (5173).
    const urlVideo = `academia-videos/file/${video.id}`;

    const comunicacion = await pool.query(
      `INSERT INTO comunicaciones
        (titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia, reacciones, asistencias, categorias_objetivo, creado_por, academia_video_id)
       VALUES ($1,$2,'Academia-Video',$3,$4,'Baja',false,'{}','[]',$5,$6,$7)
       RETURNING *`,
      [
        titulo, urlVideo, req.body.rama || 'General', req.body.categoria || 'General',
        JSON.stringify(JSON.parse(req.body.categorias_objetivo || '[]')), req.actor.rut, video.id,
      ]
    );

    return res.status(201).json({ video, comunicacion: comunicacion.rows[0] });
  } catch (error) {
    console.error('[POST /api/academia-videos]', error);
    return res.status(500).json({ error: error.message || 'No se pudo subir el video.' });
  }
});

// GET: sirve el video con soporte de Range para que el <video> del navegador
// pueda buscar/adelantar sin descargar el archivo completo de una vez.
// Sin "authenticate": esta URL se usa directo en <video><source>, que el
// navegador no puede acompañar con header Authorization (ídem <img> de
// pizarras arriba) — mismo criterio: no servir un video despublicado, el
// listado autenticado sigue siendo el control de acceso principal.
app.get('/api/academia-videos/file/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT mime_type, file_data, activo FROM academia_videos WHERE id = $1', [req.params.id]);
    const row = result.rows?.[0];
    if (!row || row.activo === false) {
      return res.status(404).json({ error: 'Video no encontrado.' });
    }

    const buffer = row.file_data;
    const total = buffer.length;
    const range = req.headers.range;

    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Accept-Ranges', 'bytes');
    res.contentType(row.mime_type || 'video/mp4');

    if (!range) {
      res.setHeader('Content-Length', total);
      return res.send(buffer);
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : total - 1;
    const chunkEnd = Math.min(end, total - 1);

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${chunkEnd}/${total}`);
    res.setHeader('Content-Length', chunkEnd - start + 1);
    return res.send(buffer.subarray(start, chunkEnd + 1));
  } catch (error) {
    console.error('[GET /api/academia-videos/file/:id]', error);
    return res.status(500).json({ error: error.message || 'No se pudo obtener el video.' });
  }
});

// PUT: actualiza metadata del video (título/publicado) y, si existe, sincroniza
// la comunicación enlazada (título/rama/categoría/categorías/publicado). Para
// reemplazar el archivo hay que borrar y volver a subir.
app.put('/api/academia-videos/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { titulo, rama, categoria, categorias_objetivo, activo } = req.body;
  try {
    const existente = await pool.query('SELECT subido_por FROM academia_videos WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Video no encontrado.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutSubio = normalizarRutParaComparar(existente.rows[0].subido_por || '');
      if (!rutSubio || rutSubio !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes editar contenido de otro profesor.' });
      }
    }

    const result = await pool.query(
      `UPDATE academia_videos SET titulo = COALESCE($1, titulo), activo = COALESCE($2, activo) WHERE id = $3
       RETURNING id, titulo, filename, tamano_bytes, activo, created_at`,
      [titulo ?? null, activo !== undefined ? Boolean(activo) : null, req.params.id]
    );

    const comunicacionVinculada = await pool.query('SELECT id FROM comunicaciones WHERE academia_video_id = $1', [req.params.id]);
    if (comunicacionVinculada.rows.length > 0) {
      await pool.query(
        `UPDATE comunicaciones SET
           titulo = COALESCE($1, titulo), rama = COALESCE($2, rama), categoria = COALESCE($3, categoria),
           categorias_objetivo = COALESCE($4::jsonb, categorias_objetivo), activo = COALESCE($5, activo), updated_at = NOW()
         WHERE id = $6`,
        [
          titulo ?? null, rama ?? null, categoria ?? null,
          categorias_objetivo !== undefined ? JSON.stringify(categorias_objetivo) : null,
          activo !== undefined ? Boolean(activo) : null,
          comunicacionVinculada.rows[0].id,
        ]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[PUT /api/academia-videos/:id]', error);
    res.status(500).json({ error: error.message || 'No se pudo actualizar el video.' });
  }
});

app.delete('/api/academia-videos/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const existente = await client.query('SELECT subido_por FROM academia_videos WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Video no encontrado.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutSubio = normalizarRutParaComparar(existente.rows[0].subido_por || '');
      if (!rutSubio || rutSubio !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes eliminar contenido de otro profesor.' });
      }
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM comunicaciones WHERE academia_video_id = $1', [req.params.id]);
    await client.query('DELETE FROM academia_videos WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DELETE /api/academia-videos/:id]', error);
    res.status(500).json({ error: error.message || 'No se pudo borrar el video.' });
  } finally {
    client.release();
  }
});

const uploadPizarraMemoria = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const permitido = ['image/png', 'image/jpeg', 'image/webp'];
    if (!permitido.includes(file.mimetype)) {
      cb(new Error('Formato de imagen no permitido para la pizarra. Usa PNG, JPG o WEBP.'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Staff/super_admin ven todo sin filtrar (incluye no publicado, para poder
// gestionarlo desde "Mis Publicaciones"). El resto solo ve lo publicado y
// dirigido a la rama/categoría de sus propios pupilos.
app.get('/api/academia-pizarras', authenticate, requireAnyModule('academia'), async (req, res) => {
  try {
    const esProfesor = ['staff', 'super_admin'].includes(normalizarRol(req.actor.rol));
    const result = await pool.query(
      `SELECT id, nombre_tactica, descripcion, imagen_filename, rama, categorias_objetivo, creado_por, activo, created_at
       FROM academia_pizarras ORDER BY created_at DESC LIMIT 300`
    );
    if (esProfesor) {
      return res.json(result.rows);
    }
    const pizarrasActivas = result.rows.filter((p) => p.activo !== false);
    const pupilos = await obtenerPupilosDeActor(req.actor);
    res.json(pizarrasActivas.filter((p) => academiaContenidoEsVisibleParaPupilos(p, pupilos)));
  } catch (error) {
    console.error('[GET /api/academia-pizarras]', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/academia-pizarras', authenticate, requireRole('staff', 'admin', 'super_admin'), uploadPizarraMemoria.single('archivo'), async (req, res) => {
  try {
    const nombreTactica = String(req.body.nombre_tactica || '').trim();
    if (!nombreTactica) {
      return res.status(400).json({ error: 'Falta el nombre de la táctica.' });
    }

    let filename = null;
    let mimeType = null;
    let data = null;
    if (req.file) {
      const extension = path.extname(req.file.originalname).toLowerCase() || '.png';
      const slug = nombreTactica.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'pizarra';
      filename = `${slug}-${Date.now()}${extension}`;
      mimeType = req.file.mimetype;
      data = req.file.buffer;
    }

    const result = await pool.query(
      `INSERT INTO academia_pizarras (nombre_tactica, descripcion, imagen_filename, imagen_mime_type, imagen_data, rama, categorias_objetivo, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, nombre_tactica, descripcion, imagen_filename, rama, categorias_objetivo, creado_por, created_at`,
      [
        nombreTactica, req.body.descripcion || '', filename, mimeType, data,
        req.body.rama || 'General', JSON.stringify(JSON.parse(req.body.categorias_objetivo || '[]')), req.actor.rut,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[POST /api/academia-pizarras]', error);
    res.status(500).json({ error: error.message || 'No se pudo guardar la pizarra.' });
  }
});

// Sin "authenticate": esta URL se usa directo en <img src>, que el navegador
// no puede acompañar con header Authorization — exigir token acá rompería la
// carga de imagen para cualquier usuario, logueado o no. Como mitigación
// real (en vez de un candado que no puede funcionar aquí), no se sirve una
// pizarra despublicada; el listado (GET /api/academia-pizarras, ese sí
// autenticado y filtrado) sigue siendo el control de acceso principal.
app.get('/api/academia-pizarras/imagen/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT imagen_mime_type, imagen_data, activo FROM academia_pizarras WHERE id = $1', [req.params.id]);
    const row = result.rows?.[0];
    if (!row || !row.imagen_data || row.activo === false) {
      return res.status(404).json({ error: 'Imagen no encontrada.' });
    }
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.contentType(row.imagen_mime_type || 'image/png');
    return res.send(row.imagen_data);
  } catch (error) {
    console.error('[GET /api/academia-pizarras/imagen/:id]', error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT: solo metadata (nombre/descripción/rama/categorías/publicado). Para
// cambiar la imagen capturada hay que borrar y crear de nuevo.
app.put('/api/academia-pizarras/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { nombre_tactica, descripcion, rama, categorias_objetivo, activo } = req.body;
  try {
    const existente = await pool.query('SELECT creado_por FROM academia_pizarras WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Pizarra no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutCreador = normalizarRutParaComparar(existente.rows[0].creado_por || '');
      if (!rutCreador || rutCreador !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes editar contenido de otro profesor.' });
      }
    }
    const result = await pool.query(
      `UPDATE academia_pizarras SET
         nombre_tactica = COALESCE($1, nombre_tactica), descripcion = COALESCE($2, descripcion),
         rama = COALESCE($3, rama), categorias_objetivo = COALESCE($4::jsonb, categorias_objetivo),
         activo = COALESCE($5, activo)
       WHERE id = $6
       RETURNING id, nombre_tactica, descripcion, imagen_filename, rama, categorias_objetivo, creado_por, activo, created_at`,
      [
        nombre_tactica ?? null, descripcion ?? null, rama ?? null,
        categorias_objetivo !== undefined ? JSON.stringify(categorias_objetivo) : null,
        activo !== undefined ? Boolean(activo) : null,
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[PUT /api/academia-pizarras/:id]', error);
    res.status(500).json({ error: error.message || 'No se pudo actualizar la pizarra.' });
  }
});

app.delete('/api/academia-pizarras/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const existente = await pool.query('SELECT creado_por FROM academia_pizarras WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Pizarra no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutCreador = normalizarRutParaComparar(existente.rows[0].creado_por || '');
      if (!rutCreador || rutCreador !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes eliminar contenido de otro profesor.' });
      }
    }
    await pool.query('DELETE FROM academia_pizarras WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/academia-pizarras/:id]', error);
    res.status(500).json({ error: error.message || 'No se pudo borrar la pizarra.' });
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

// Repara el vinculo por RUT entre jugadores y su cuenta apoderada para
// asignaciones hechas ANTES del fix que hizo que "asignar pupilo" tambien
// escribiera rut_apoderado (antes solo quedaba correo_apoderado). Empareja
// por correo_apoderado <-> cuentas.correo y completa el RUT faltante, sin
// tocar ningun otro campo.
app.post('/api/admin/backfill-rut-apoderado', async (req, res) => {
  const configuredToken = String(process.env.ADMIN_SYNC_TOKEN || '').trim();
  if (!configuredToken) {
    return res.status(503).json({
      error: 'Backfill deshabilitado: falta ADMIN_SYNC_TOKEN en variables de entorno.',
    });
  }

  const requestToken = getSyncTokenFromRequest(req);
  if (!requestToken || requestToken !== configuredToken) {
    return res.status(401).json({ error: 'Token invalido para ejecutar el backfill.' });
  }

  try {
    const result = await pool.query(
      `UPDATE jugadores j
       SET rut_apoderado = c.rut, updated_at = NOW()
       FROM cuentas c
       WHERE COALESCE(TRIM(j.rut_apoderado), '') = ''
         AND COALESCE(TRIM(j.correo_apoderado), '') <> ''
         AND COALESCE(TRIM(c.rut), '') <> ''
         AND LOWER(TRIM(c.correo)) = LOWER(TRIM(j.correo_apoderado))
       RETURNING j.rut_jugador, j.nombres, j.correo_apoderado, j.rut_apoderado`
    );

    return res.json({
      ok: true,
      actualizados: result.rows.length,
      detalle: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'No se pudo ejecutar el backfill de rut_apoderado.',
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
    console.error('[POST /api/admin/sync-sheets/webhook-flush]', error);
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

// Antes compartía authRateLimiter con /login: una familia equivocándose al
// escribir la clave nueva durante el cambio obligatorio de contraseña podía
// agotar el cupo y quedar bloqueada también para volver a iniciar sesión.
// Limiter propio, más holgado, porque acá no hay riesgo de fuerza bruta de
// credenciales (requiere ya conocer la contraseña actual).
const changePasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
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
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', changePasswordRateLimiter, async (req, res) => {
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
    console.error('[POST /api/auth/change-password]', err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 1. ENDPOINTS: COMUNICACIONES
// ==========================================

// GET: Todas las comunicaciones
const ACADEMIA_TIPOS_LOWER = new Set(['academia-video', 'academia-imagen', 'academia-documento']);

// Sin sesión (visitante del feed público de Noticias) o con sesión pero sin
// módulo staff: nunca ve contenido de Academia sin publicar ni fuera de la
// rama/categoría de sus propios pupilos. Antes esta ruta era 100% pública y
// sin filtrar — cualquiera con la URL veía todo, incluido material docente.
const filtrarComunicacionesParaActor = async (filas, actor) => {
  const esProfesor = actor && ['staff', 'super_admin'].includes(normalizarRol(actor.rol));
  if (esProfesor) return filas;

  if (!actor) {
    return filas.filter((f) => !ACADEMIA_TIPOS_LOWER.has(String(f.tipo || '').toLowerCase()));
  }

  const pupilos = await obtenerPupilosDeActor(actor);
  return filas.filter((f) => {
    if (!ACADEMIA_TIPOS_LOWER.has(String(f.tipo || '').toLowerCase())) return true;
    if (f.activo === false) return false;
    return academiaContenidoEsVisibleParaPupilos(f, pupilos);
  });
};

app.get('/api/comunicaciones', authenticateOpcional, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, titulo, cuerpo_texto, tipo, rama, categoria, urgencia,
        solicita_asistencia, reacciones, asistencias,
        citacion_id, convocatoria_ruts, convocatoria_alertas_morosidad,
        responsable_nombre, responsable_rol, categorias_objetivo,
        creado_por, academia_video_id, activo,
        created_at as fecha
      FROM comunicaciones
      ORDER BY created_at DESC
    `);
    res.json(await filtrarComunicacionesParaActor(result.rows, req.actor));
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Comunicación por ID
app.get('/api/comunicaciones/:id', authenticateOpcional, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicaciones WHERE id = $1',
      [req.params.id]
    );
    const fila = result.rows[0];
    if (!fila) return res.json({});
    const visibles = await filtrarComunicacionesParaActor([fila], req.actor);
    res.json(visibles[0] || {});
  } catch (err) {
    console.error('[GET /api/comunicaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear comunicación. requireRole (no requireModule('admin_dashboard'))
// porque 'staff' publica material de Academia desde este mismo endpoint y no
// tiene el módulo admin_dashboard — antes quedaba bloqueado con 403.
app.post('/api/comunicaciones', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const {
    titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia,
    citacion_id, convocatoria_ruts, convocatoria_alertas_morosidad,
    responsable_nombre, responsable_rol, categorias_objetivo,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO comunicaciones
       (titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia, reacciones, asistencias,
        citacion_id, convocatoria_ruts, convocatoria_alertas_morosidad, responsable_nombre, responsable_rol, categorias_objetivo, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia || false, '{}', '[]',
        citacion_id || null, JSON.stringify(convocatoria_ruts || []), JSON.stringify(convocatoria_alertas_morosidad || []),
        responsable_nombre || null, responsable_rol || null, JSON.stringify(categorias_objetivo || []), req.actor.rut,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/comunicaciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar comunicación. requireRole (no requireModule('admin_dashboard'))
// para que 'staff' pueda editar SU material de Academia — solo lo puede tocar
// quien lo creó (creado_por) o un admin/super_admin.
app.put('/api/comunicaciones/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { titulo, cuerpo_texto, urgencia, rama, categoria, categorias_objetivo, activo } = req.body;
  try {
    const existente = await pool.query('SELECT creado_por FROM comunicaciones WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Comunicación no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutCreador = normalizarRutParaComparar(existente.rows[0].creado_por || '');
      if (!rutCreador || rutCreador !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes editar contenido de otro profesor.' });
      }
    }

    const result = await pool.query(
      `UPDATE comunicaciones
       SET titulo = COALESCE($1, titulo),
           cuerpo_texto = COALESCE($2, cuerpo_texto),
           urgencia = COALESCE($3, urgencia),
           rama = COALESCE($4, rama),
           categoria = COALESCE($5, categoria),
           categorias_objetivo = COALESCE($6::jsonb, categorias_objetivo),
           activo = COALESCE($7, activo),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        titulo ?? null, cuerpo_texto ?? null, urgencia ?? null, rama ?? null, categoria ?? null,
        categorias_objetivo !== undefined ? JSON.stringify(categorias_objetivo) : null,
        activo !== undefined ? Boolean(activo) : null,
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/comunicaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Eliminar comunicación. Mismo criterio de dueño que el PUT de arriba.
app.delete('/api/comunicaciones/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const existente = await pool.query('SELECT creado_por FROM comunicaciones WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Comunicación no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutCreador = normalizarRutParaComparar(existente.rows[0].creado_por || '');
      if (!rutCreador || rutCreador !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes eliminar contenido de otro profesor.' });
      }
    }
    await pool.query('DELETE FROM comunicaciones WHERE id = $1', [req.params.id]);
    res.json({ message: 'Comunicación eliminada' });
  } catch (err) {
    console.error('[DELETE /api/comunicaciones/:id]', err);
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
    console.error('[GET /api/comunicaciones/:comId/comentarios]', err);
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
    console.error('[POST /api/comunicaciones/:comId/comentarios]', err);
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
    console.error('[PUT /api/comentarios/:comentId/like]', err);
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
    console.error('[GET /api/pagos/usuario/:usuarioId]', err);
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
    console.error('[GET /api/pagos]', err);
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
    console.error('[POST /api/pagos]', err);
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
    console.error('[PUT /api/pagos/:pagoId/validar]', err);
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
    console.error('[GET /api/usuarios]', err);
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
    console.error('[GET /api/usuarios/:id]', err);
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
    console.error('[POST /api/usuarios]', err);
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
    console.error('[GET /api/cuentas]', err);
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
    console.error('[GET /api/cuentas/incompletas]', err);
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
    console.error('[GET /api/cuentas/:id]', err);
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
    console.error('[POST /api/cuentas]', err);
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
    console.error('[POST /api/cuentas]', err);
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
    console.error('[DELETE /api/cuentas/:id]', err);
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
    console.error('[GET /api/whatsapp/contactos]', err);
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
      console.error('[POST /api/whatsapp/contactos]', err);
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
    console.error('[DELETE /api/whatsapp/contactos/:id]', err);
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
    console.error('[POST /api/whatsapp/enviar]', err);
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
    console.error('[GET /api/reportes/engagement]', err);
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
    console.error('[GET /api/reportes/top-comunicaciones]', err);
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
    console.error('[GET /api/encuestas]', err);
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
    console.error('[POST /api/encuestas]', err);
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
    console.error('[PUT /api/encuestas/:encuestaId/votar]', err);
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

// Marca 'no asiste' automáticamente a quien no respondió una citación antes
// de su hora_maxima_confirmacion (ver barrerCitacionesVencidas).
cron.schedule('*/5 * * * *', async () => {
  try {
    await barrerCitacionesVencidas();
  } catch (err) {
    console.error('[CRON] Error en barrido de citaciones vencidas:', err.message);
  }
});

// ==========================================
// 9. ENDPOINTS: JUGADORES (FASE 1)
// ==========================================

// GET: Todos los jugadores
// Sin gate de módulo: casi todos los roles reales (jugador/apoderado vía
// bootstrap para resolver su propio pupilo, staff, mesa para el roster en
// vivo, admin) necesitan esta lista hoy. Solo se exige sesión válida.
// Antes devolvía el roster completo a cualquier cuenta autenticada (un
// apoderado o socio podía traerse los datos de TODOS los deportistas del
// club, no solo los suyos, llamando la API directo). Staff/admin/super_admin
// y cualquier otro rol no listado en ROLES_JUGADORES_ACOTADOS siguen viendo
// todo, igual que hoy.
// Nivel de Academia derivado de xp_total (100 XP por nivel). Réplica exacta
// de calcularNivelDesdeXP en src/utils/gamificacion.js — mantener ambas en sync.
const calcularNivelDesdeXPTotal = (xpTotal) => Math.floor(Number(xpTotal || 0) / 100) + 1;

app.get('/api/jugadores', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, COALESCE(SUM(gp.puntos_obtenidos), 0) AS xp_total
       FROM jugadores j
       LEFT JOIN gamificacion_puntos gp ON gp.rut_jugador = j.rut_jugador
       GROUP BY j.rut_jugador
       ORDER BY j.apellido_paterno ASC`
    );
    const filas = result.rows.map((j) => ({ ...j, xp_total: Number(j.xp_total), nivel_actual: calcularNivelDesdeXPTotal(j.xp_total) }));
    if (!ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(req.actor.rol))) {
      return res.json(filas);
    }
    const pupilos = await obtenerPupilosDeActor(req.actor);
    const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
    res.json(filas.filter((j) => rutsPupilos.has(normalizarRutParaComparar(j.rut_jugador))));
  } catch (err) {
    console.error('[GET /api/jugadores]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Jugador por RUT — mismo criterio de acotamiento que la lista de arriba.
app.get('/api/jugadores/:rut', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, COALESCE(SUM(gp.puntos_obtenidos), 0) AS xp_total
       FROM jugadores j
       LEFT JOIN gamificacion_puntos gp ON gp.rut_jugador = j.rut_jugador
       WHERE j.rut_jugador = $1
       GROUP BY j.rut_jugador`,
      [req.params.rut]
    );
    const jugador = result.rows[0];
    if (!jugador) return res.json({});
    jugador.xp_total = Number(jugador.xp_total);
    jugador.nivel_actual = calcularNivelDesdeXPTotal(jugador.xp_total);

    if (ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(req.actor.rol))) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
      if (!rutsPupilos.has(normalizarRutParaComparar(jugador.rut_jugador))) {
        return res.status(403).json({ error: 'No tienes acceso a este deportista.' });
      }
    }
    res.json(jugador);
  } catch (err) {
    console.error('[GET /api/jugadores/:rut]', err);
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
    console.error('[POST /api/jugadores]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar jugador por RUT
const CAMPOS_JUGADOR_SOLO_ADMIN = [
  'rut_apoderado', 'correo_apoderado', 'correo_jugador', 'password_jugador', 'forzar_clave_jugador',
  'rama', 'categoria', 'numero_camiseta', 'fecha_ingreso', 'mes_inicio_cobro', 'beca',
  'valor_mensualidad', 'matricula_pagada', 'polera_entregada', 'poleron_entregado',
  'estado', 'estado_deportivo', 'fecha_inicio_baja', 'fecha_fin_baja', 'xp_puntos',
];

// El apoderado dueño (rut_apoderado registrado) puede editar el perfil de su propio
// pupilo (datos personales, salud, contacto, tallas); los campos administrativos
// (categoría, mensualidad, beca, vínculo de cuenta, etc.) quedan reservados a admin.
app.put('/api/jugadores/:rut', authenticate, requireApoderadoDeJugadorOModule(pool, 'admin_dashboard'), stripFieldsUnlessModule(CAMPOS_JUGADOR_SOLO_ADMIN, 'admin_dashboard'), async (req, res) => {
  const {
    rut_apoderado,
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
    diseno_marco,
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
        rut_apoderado = COALESCE($42, rut_apoderado),
        diseno_marco = COALESCE($43, diseno_marco),
        updated_at = NOW()
      WHERE rut_jugador = $44
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
        rut_apoderado ?? null,
        diseno_marco ?? null,
        req.params.rut,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/jugadores/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: el apoderado dueño del jugador (o admin) sube la foto para la
// tarjeta coleccionable. Reutiliza el almacenamiento de logo_assets (misma
// tabla BYTEA que ya sirve logos) en vez de crear otra tabla para lo mismo.
app.post('/api/jugadores/:rut/foto', authenticate, requireApoderadoDeJugadorOModule(pool, 'admin_dashboard'), uploadLogoMemoria.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar una foto.' });
    }

    const rut = String(req.params.rut || '').trim();
    const extension = path.extname(req.file.originalname).toLowerCase() || '.png';
    const filename = `foto-jugador-${normalizarRutParaComparar(rut)}-${Date.now()}${extension}`;

    await pool.query(
      `INSERT INTO logo_assets (nombre, tipo, filename, mime_type, file_data)
       VALUES ($1, 'foto-jugador', $2, $3, $4)`,
      [`Foto ${rut}`, filename, req.file.mimetype, req.file.buffer]
    );

    const urlFoto = `/api/logo-assets/file/${encodeURIComponent(filename)}`;
    const result = await pool.query(
      `UPDATE jugadores SET foto_jugador = $1, updated_at = NOW() WHERE rut_jugador = $2 RETURNING *`,
      [urlFoto, rut]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[POST /api/jugadores/:rut/foto]', error);
    return res.status(500).json({ error: error.message || 'No se pudo subir la foto.' });
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
    console.error('[DELETE /api/jugadores/:rut]', err);
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
    console.error('[GET /api/pagos-mensualidades]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pago de mensualidad
const ANIO_OBJETIVO_TESORERIA = 2026;
const MESES_ABREV_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const obtenerMesNumeroDesdeTexto = (texto = '') => {
  const normalizado = String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!normalizado) return null;
  const token = normalizado.slice(0, 3);
  const idx = MESES_ABREV_ES.findIndex((m) => m === token);
  return idx >= 0 ? idx + 1 : null;
};

// Primer mes/año de un pago, tolerante a los dos formatos vigentes:
// "mar-2026" (autoservicio de apoderado) y "Marzo 2026" / "Marzo-Abril 2026" (form admin).
const parsearPrimerMesDePago = (mesesCorrespondientes = '') => {
  const texto = String(mesesCorrespondientes || '').trim();
  if (!texto) return null;
  const anioMatch = texto.match(/(20\d{2})/);
  const anio = anioMatch ? Number(anioMatch[1]) : null;
  const sinAnio = texto.replace(/20\d{2}/g, '').trim();
  const primerToken = sinAnio.split(/[-\s]+/).filter(Boolean)[0] || '';
  const mes = obtenerMesNumeroDesdeTexto(primerToken);
  if (!mes || !anio) return null;
  return { mes, anio };
};

// Primer mes cobrable de un jugador. Si el admin fijó mes_inicio_cobro a mano,
// ese valor es su criterio final y se respeta tal cual (mismo criterio que ya
// usa el cálculo de morosos). Si no, se deriva de fecha_ingreso cobrando desde
// el mes SIGUIENTE al de ingreso (regla de negocio: sin prorrateo del mes de ingreso).
const obtenerPrimerMesCobrableJugador = (jugador = {}) => {
  const anioCandidatos = [jugador?.anio_ingreso, jugador?.año_ingreso]
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v >= 2000 && v <= 2100);
  let anio = anioCandidatos[0] || null;

  const mesDesdeCampo = obtenerMesNumeroDesdeTexto(jugador?.mes_inicio_cobro || '');
  if (mesDesdeCampo) {
    if (!anio) {
      const matchFecha = String(jugador?.fecha_ingreso || '').match(/(20\d{2})/);
      anio = matchFecha ? Number(matchFecha[1]) : ANIO_OBJETIVO_TESORERIA;
    }
    return { anio, mes: mesDesdeCampo };
  }

  const fechaIngreso = String(jugador?.fecha_ingreso || '').trim();
  const fecha = fechaIngreso ? new Date(fechaIngreso) : null;
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    const anioFecha = anio || fecha.getFullYear();
    const mesFecha = fecha.getMonth() + 1;
    return mesFecha >= 12 ? { anio: anioFecha + 1, mes: 1 } : { anio: anioFecha, mes: mesFecha + 1 };
  }

  return null;
};

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
    const rolNormalizadoPago = normalizarRol(req.actor.rol);
    const esStaffOAdminPago = !ROLES_JUGADORES_ACOTADOS.includes(rolNormalizadoPago);
    if (!esStaffOAdminPago && String(rut_jugador || '').trim()) {
      const jugadorPago = (await pool.query(
        'SELECT fecha_ingreso, mes_inicio_cobro FROM jugadores WHERE rut_jugador = $1',
        [rut_jugador]
      )).rows[0];
      const primerMesCobrable = jugadorPago ? obtenerPrimerMesCobrableJugador(jugadorPago) : null;
      const primerMesDelPago = parsearPrimerMesDePago(meses_correspondientes);
      if (primerMesCobrable && primerMesDelPago) {
        const ordinalCobrable = primerMesCobrable.anio * 12 + primerMesCobrable.mes;
        const ordinalPago = primerMesDelPago.anio * 12 + primerMesDelPago.mes;
        if (ordinalPago < ordinalCobrable) {
          return res.status(400).json({
            error: `No se pueden pagar meses anteriores al inicio de cobro (${MESES_ABREV_ES[primerMesCobrable.mes - 1]}-${primerMesCobrable.anio}).`,
          });
        }
      }
    }

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
    console.error('[POST /api/pagos-mensualidades]', err);
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
    console.error('[PUT /api/pagos-mensualidades/:id/validar]', err);
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
    console.error('[GET /api/pagos-mensualidades/:id]', err);
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
    console.error('[PUT /api/pagos-mensualidades/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: jugadores con beca activa (%>0) y si ya tienen revisión del mes
// pedido — el admin/superadmin designado confirma mes a mes que la beca
// sigue vigente (ver tabla beca_revisiones).
app.get('/api/beca-revisiones', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const mes = String(req.query.mes || '').trim();
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'Falta el parámetro mes en formato YYYY-MM.' });
  }
  try {
    const becados = await pool.query(
      `SELECT rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, beca
       FROM jugadores
       WHERE beca IS NOT NULL AND beca > 0 AND (estado IS NULL OR UPPER(estado) <> 'BAJA')
       ORDER BY nombres ASC`
    );
    const revisiones = await pool.query(
      `SELECT rut_jugador, porcentaje, revisado_por, revisado_en FROM beca_revisiones WHERE mes = $1`,
      [mes]
    );
    const revisionesPorRut = new Map(revisiones.rows.map((r) => [String(r.rut_jugador).trim(), r]));

    const resultado = becados.rows.map((j) => ({
      ...j,
      revision_mes_actual: revisionesPorRut.get(String(j.rut_jugador).trim()) || null,
    }));
    res.json(resultado);
  } catch (err) {
    console.error('[GET /api/beca-revisiones]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: confirma (o actualiza) la revisión mensual de una beca. Si el
// porcentaje cambió respecto al de jugadores.beca, también lo actualiza ahí
// (ej. se le bajó o retiró la beca al revisarla).
app.post('/api/beca-revisiones', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { rut_jugador, mes, porcentaje } = req.body;
  if (!String(rut_jugador || '').trim() || !/^\d{4}-\d{2}$/.test(String(mes || ''))) {
    return res.status(400).json({ error: 'Faltan rut_jugador o mes (formato YYYY-MM) válidos.' });
  }
  const porcentajeNum = Number(porcentaje);
  if (!Number.isFinite(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100) {
    return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const revision = await client.query(
      `INSERT INTO beca_revisiones (rut_jugador, mes, porcentaje, revisado_por, revisado_en)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (rut_jugador, mes) DO UPDATE
         SET porcentaje = EXCLUDED.porcentaje, revisado_por = EXCLUDED.revisado_por, revisado_en = NOW()
       RETURNING *`,
      [rut_jugador, mes, porcentajeNum, req.actor?.rut || null]
    );
    await client.query('UPDATE jugadores SET beca = $1 WHERE rut_jugador = $2', [porcentajeNum, rut_jugador]);
    await client.query('COMMIT');
    res.status(201).json(revision.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/beca-revisiones]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
    console.error('[GET /api/convocatorias]', err);
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
    console.error('[POST /api/convocatorias]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11B. ENDPOINTS: CITACIONES (persistencia real + RSVP + notificaciones)
// ==========================================

// pg devuelve las columnas DATE como objetos Date; interpolarlas directo en un
// template literal cae en Date.toString() (verboso, con huso horario). Esto
// las deja en YYYY-MM-DD para el cuerpo de la notificación.
const formatearFechaCitacion = (valor) => {
  if (!valor) return 'por confirmar';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return fecha.toISOString().slice(0, 10);
};

// Crea una fila de notificación in-app para un RUT destinatario. No lanza:
// una notificación fallida no debe tumbar la creación/RSVP de la citación.
const crearNotificacionApp = async ({ rut, tipo, titulo, cuerpo, referenciaTipo, referenciaId }) => {
  const rutLimpio = String(rut || '').trim();
  if (!rutLimpio) return;
  try {
    await pool.query(
      `INSERT INTO notificaciones_app (rut_destinatario, tipo, titulo, cuerpo, referencia_tipo, referencia_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [rutLimpio, tipo, titulo, cuerpo, referenciaTipo, referenciaId]
    );
  } catch (err) {
    console.error('❌ Error creando notificación in-app:', err.message);
  }
};

// Resuelve los RUT a notificar por cada convocado: el apoderado registrado
// (por rut_apoderado, con correo_apoderado como respaldo) y la cuenta propia
// del jugador si inició sesión alguna vez con su propio RUT.
const resolverDestinatariosCitacion = async (convocados) => {
  const ruts = new Set();
  for (const conv of convocados) {
    const rutJugador = String(conv.rut_jugador || '').trim();
    if (!rutJugador) continue;

    const jugadorRow = await pool.query(
      'SELECT rut_apoderado, correo_apoderado FROM jugadores WHERE rut_jugador = $1',
      [rutJugador]
    );
    const rutApoderado = String(jugadorRow.rows[0]?.rut_apoderado || '').trim();
    const correoApoderado = String(jugadorRow.rows[0]?.correo_apoderado || conv.correo_apoderado || '').trim();

    if (rutApoderado) {
      ruts.add(normalizarRutParaComparar(rutApoderado));
    } else if (correoApoderado) {
      const cuentaPorCorreo = await pool.query('SELECT rut FROM cuentas WHERE LOWER(correo) = LOWER($1)', [correoApoderado]);
      if (cuentaPorCorreo.rows[0]?.rut) ruts.add(normalizarRutParaComparar(cuentaPorCorreo.rows[0].rut));
    }

    const cuentaJugador = await pool.query(
      "SELECT rut FROM cuentas WHERE REPLACE(REPLACE(UPPER(rut), '.', ''), '-', '') = $1",
      [normalizarRutParaComparar(rutJugador)]
    );
    if (cuentaJugador.rows[0]?.rut) ruts.add(normalizarRutParaComparar(cuentaJugador.rows[0].rut));
  }
  return ruts;
};

// Destinatarios de un evento de RSVP (confirmación/rechazo, manual o
// automático por vencimiento de plazo): el responsable de la citación
// (quien la creó) más toda cuenta admin/super_admin, para que el club
// siempre se entere aunque no haya sido ese admin quien la creó.
const resolverDestinatariosRSVP = async (responsableRut) => {
  const ruts = new Set();
  if (responsableRut) ruts.add(normalizarRutParaComparar(responsableRut));
  const admins = await pool.query("SELECT rut FROM cuentas WHERE LOWER(rol) IN ('admin', 'super_admin', 'superadmin')");
  admins.rows.forEach((row) => { if (row.rut) ruts.add(normalizarRutParaComparar(row.rut)); });
  return ruts;
};

// Barrido idempotente: cualquier convocado 'pendiente' cuya citación ya pasó
// su hora_maxima_confirmacion se marca 'no' automáticamente (sin
// justificación, respondido_automaticamente=true). Se puede correr tantas
// veces como se quiera: una segunda corrida no vuelve a tocar filas que ya
// dejaron de estar 'pendiente'. Se llama desde un cron (cada 5 min) y además
// al inicio de los GET de citaciones, para que la vista se vea correcta al
// instante aunque el cron no haya corrido todavía.
const barrerCitacionesVencidas = async () => {
  const result = await pool.query(`
    UPDATE citacion_convocados cc
    SET respuesta = 'no', respondido_automaticamente = true, actualizado_en = NOW()
    FROM citaciones c
    WHERE cc.citacion_id = c.id
      AND cc.respuesta = 'pendiente'
      AND c.hora_maxima_confirmacion IS NOT NULL
      AND c.hora_maxima_confirmacion <= NOW()
    RETURNING cc.id, cc.citacion_id, cc.nombre, c.responsable_rut, c.tipo_competencia, c.competencia_nombre, c.rival_nombre, c.dia_citacion
  `);
  if (result.rows.length === 0) return;

  const porCitacion = new Map();
  result.rows.forEach((row) => {
    const lista = porCitacion.get(row.citacion_id) || [];
    lista.push(row);
    porCitacion.set(row.citacion_id, lista);
  });

  for (const [citacionId, filas] of porCitacion) {
    const info = filas[0];
    const destinatarios = await resolverDestinatariosRSVP(info.responsable_rut);
    const titulo = `Plazo vencido: ${filas.length} sin responder`;
    const cuerpo = `${filas.length} deportista(s) fueron marcados automáticamente como "no asiste" por no responder antes del plazo — ${info.tipo_competencia || ''} ${info.competencia_nombre || ''} vs ${info.rival_nombre || ''} (${formatearFechaCitacion(info.dia_citacion)}).`;
    await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
      rut, tipo: 'citacion_rsvp_automatico', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: citacionId,
    })));
  }
};

// Trae los RUT de los pupilos del actor (apoderado) o el propio RUT si el
// actor es un jugador con cuenta propia, junto a su rama/categoría — base
// para filtrar qué citaciones puede ver un usuario no administrativo.
// Además de rut_apoderado/rut_jugador, hace fallback por correo_apoderado:
// mismo criterio que ya usa el frontend (pupilosDisponibles en App.jsx) y
// resolverDestinatariosCitacion, porque no todo jugador tiene rut_apoderado
// completo (el backfill de esa columna no cubre el 100% de los casos) —
// sin este fallback, un apoderado que solo calza por correo vería CERO
// pupilos en vez de los suyos al filtrar por rol.
const obtenerPupilosDeActor = async (actor) => {
  const rutActor = normalizarRutParaComparar(actor.rut);
  const cuentaActor = await pool.query('SELECT correo FROM cuentas WHERE rut = $1', [actor.rut]);
  const correoActor = String(cuentaActor.rows[0]?.correo || '').trim().toLowerCase();

  const result = await pool.query(
    `SELECT rut_jugador, rama, categoria FROM jugadores
     WHERE REPLACE(REPLACE(UPPER(rut_apoderado), '.', ''), '-', '') = $1
        OR REPLACE(REPLACE(UPPER(rut_jugador), '.', ''), '-', '') = $1
        OR ($2 <> '' AND LOWER(TRIM(correo_apoderado)) = $2)`,
    [rutActor, correoActor]
  );
  return result.rows;
};

// Roles cuyo acceso a /api/jugadores debe quedar acotado a sus propios
// pupilos (mismo criterio que esJugadorAutenticado/esPerfilFamiliar en
// App.jsx). Cualquier otro rol (staff, admin, super_admin, mesa, visita,
// etc.) mantiene el comportamiento actual sin cambios.
const ROLES_JUGADORES_ACOTADOS = ['jugador', 'apoderado', 'socio', 'socio_apoderado', 'socio-apoderado', 'directiva'];

const citacionEsVisibleParaPupilos = (citacion, pupilos) => {
  const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
  const esConvocado = (citacion.convocados || []).some((c) => rutsPupilos.has(normalizarRutParaComparar(c.rut_jugador)));
  if (esConvocado) return true;

  const categoriasApoyo = Array.isArray(citacion.categorias_apoyo) ? citacion.categorias_apoyo : [];
  return pupilos.some((p) => {
    const ramaCoincide = !citacion.rama || citacion.rama === 'todas' || String(citacion.rama).toLowerCase() === String(p.rama || '').toLowerCase();
    if (!ramaCoincide) return false;
    const categoriaBaseCoincide = !citacion.categoria_base || citacion.categoria_base === 'todas' || String(citacion.categoria_base).toLowerCase() === String(p.categoria || '').toLowerCase();
    const enApoyo = categoriasApoyo.some((cat) => String(cat).toLowerCase() === String(p.categoria || '').toLowerCase());
    return categoriaBaseCoincide || enApoyo;
  });
};

// Mismo criterio que ya usaba el frontend para materiales (AcademiaPanel.jsx
// materialesVisibles): rama 'General' o sin categorias_objetivo = visible
// para toda la rama del pupilo; con categorias_objetivo, el pupilo debe
// calzar. Se usa para dar filtrado real en el servidor a pizarras y quiz,
// que antes no filtraban nada.
const academiaContenidoEsVisibleParaPupilos = (contenido, pupilos) => {
  const ramaContenido = String(contenido.rama || 'General').toLowerCase();
  const categoriasObjetivo = Array.isArray(contenido.categorias_objetivo)
    ? contenido.categorias_objetivo.map((c) => String(c).toLowerCase())
    : [];
  return pupilos.some((p) => {
    const ramaCoincide = ramaContenido === 'general' || ramaContenido === String(p.rama || '').toLowerCase();
    if (!ramaCoincide) return false;
    if (categoriasObjetivo.length === 0) return true;
    return categoriasObjetivo.includes(String(p.categoria || '').toLowerCase());
  });
};

// Lista explícita de columnas de "citaciones" (en vez de SELECT/RETURNING *)
// para poder castear hora_maxima_confirmacion con to_char: es un TIMESTAMP
// sin timezone que pg parsearía a un JS Date interpretándolo con el timezone
// del PROCESO NODE (no el de la sesión de Postgres) — verificado que en un
// host con timezone distinta a Chile eso desfasa la hora al serializar a
// JSON. to_char devuelve el valor guardado tal cual, sin conversión alguna.
const CITACION_COLUMNAS_SQL = `
  id, tipo_competencia, competencia_nombre, competencia_logo_url,
  dia_citacion, hora_citacion, hora_presentacion,
  rival_nombre, rival_logo_url, rama, categoria_base, categorias_apoyo,
  responsable_nombre, responsable_rut, responsable_correo, responsable_rol,
  estado, creado_en, updated_at,
  to_char(hora_maxima_confirmacion, 'YYYY-MM-DD"T"HH24:MI') AS hora_maxima_confirmacion
`;

const cargarCitacionConConvocados = async (id) => {
  const citacionRes = await pool.query(`SELECT ${CITACION_COLUMNAS_SQL} FROM citaciones WHERE id = $1`, [id]);
  if (citacionRes.rows.length === 0) return null;
  // Se agrega jugadores.rut_apoderado (no vive en citacion_convocados) para
  // que el frontend identifique al apoderado por la MISMA columna que ya usa
  // requireApoderadoDeJugador para autorizar el RSVP, en vez de adivinar por correo.
  // fecha_nacimiento se agrega para la regla sub-13: a partir de esa edad el
  // propio jugador también puede responder su citación (ver ComunicacionesPanel).
  const convocadosRes = await pool.query(
    `SELECT cc.*, j.rut_apoderado, j.fecha_nacimiento
     FROM citacion_convocados cc
     LEFT JOIN jugadores j ON j.rut_jugador = cc.rut_jugador
     WHERE cc.citacion_id = $1
     ORDER BY cc.nombre ASC`,
    [id]
  );
  return { ...citacionRes.rows[0], convocados: convocadosRes.rows };
};

// POST: crear citación con su nómina inicial de convocados. Notifica al
// apoderado y, si existe, a la cuenta propia del jugador de cada convocado.
app.post('/api/citaciones', authenticate, requireModule('citaciones'), async (req, res) => {
  const {
    tipo_competencia, competencia_nombre, competencia_logo_url,
    dia_citacion, hora_citacion, hora_presentacion, hora_maxima_confirmacion,
    rival_nombre, rival_logo_url,
    rama, categoria_base, categorias_apoyo,
    convocados,
  } = req.body;

  if (!String(competencia_nombre || '').trim() || !String(rival_nombre || '').trim()) {
    return res.status(400).json({ error: 'Debes indicar la competencia y el equipo rival.' });
  }
  if (!Array.isArray(convocados) || convocados.length === 0) {
    return res.status(400).json({ error: 'Selecciona al menos un deportista para la citación.' });
  }

  const client = await pool.connect();
  try {
    const actorRow = await client.query('SELECT nombres, apellido_paterno, correo, rol FROM cuentas WHERE rut = $1', [req.actor.rut]);
    const actorCuenta = actorRow.rows[0] || {};
    const responsableNombre = `${actorCuenta.nombres || ''} ${actorCuenta.apellido_paterno || ''}`.trim() || actorCuenta.correo || 'Administración CCF';

    await client.query('BEGIN');
    const citacionRes = await client.query(
      `INSERT INTO citaciones
        (tipo_competencia, competencia_nombre, competencia_logo_url, dia_citacion, hora_citacion, hora_presentacion,
         hora_maxima_confirmacion,
         rival_nombre, rival_logo_url, rama, categoria_base, categorias_apoyo,
         responsable_nombre, responsable_rut, responsable_correo, responsable_rol)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING ${CITACION_COLUMNAS_SQL}`,
      [
        tipo_competencia || null, competencia_nombre, competencia_logo_url || null,
        dia_citacion || null, hora_citacion || null, hora_presentacion || null,
        hora_maxima_confirmacion || null,
        rival_nombre, rival_logo_url || null, rama || 'todas', categoria_base || 'todas',
        JSON.stringify(Array.isArray(categorias_apoyo) ? categorias_apoyo : []),
        responsableNombre, req.actor.rut, actorCuenta.correo || null, actorCuenta.rol || req.actor.rol,
      ]
    );
    const citacion = citacionRes.rows[0];

    for (const conv of convocados) {
      if (!String(conv.rut_jugador || '').trim()) continue;
      await client.query(
        `INSERT INTO citacion_convocados
          (citacion_id, rut_jugador, nombre, rama, categoria, correo_apoderado, requiere_excepcion_morosidad, estado_excepcion)
         VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 THEN 'solicitada' ELSE 'no_requiere' END)
         ON CONFLICT (citacion_id, rut_jugador) DO NOTHING`,
        [
          citacion.id, conv.rut_jugador, conv.nombre || '', conv.rama || '', conv.categoria || '',
          conv.correo_apoderado || null, Boolean(conv.requiere_excepcion_morosidad),
        ]
      );
    }

    await client.query('COMMIT');

    const destinatarios = await resolverDestinatariosCitacion(convocados);
    const titulo = `Citación ${citacion.tipo_competencia || ''}: ${citacion.competencia_nombre}`.trim();
    const cuerpo = `Convocatoria vs ${citacion.rival_nombre}. Día ${formatearFechaCitacion(citacion.dia_citacion)}, presentación ${citacion.hora_presentacion || '-'}.`;
    await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
      rut, tipo: 'citacion', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: citacion.id,
    })));

    const completa = await cargarCitacionConConvocados(citacion.id);
    res.status(201).json(completa);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/citaciones]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET: lista de citaciones visibles para el actor. Admin/super_admin con
// módulo citaciones ven todas; cualquier otra cuenta con el módulo (ej. un
// profesor con permiso individual) ve solo las que creó; el resto solo las
// suyas como convocado o las de la rama/categoría de sus pupilos.
app.get('/api/citaciones', authenticate, async (req, res) => {
  try {
    await barrerCitacionesVencidas();

    const citacionesRes = await pool.query(`SELECT ${CITACION_COLUMNAS_SQL} FROM citaciones ORDER BY dia_citacion DESC NULLS LAST, hora_citacion ASC`);
    const convocadosRes = await pool.query(
      `SELECT cc.*, j.rut_apoderado, j.fecha_nacimiento
       FROM citacion_convocados cc
       LEFT JOIN jugadores j ON j.rut_jugador = cc.rut_jugador
       ORDER BY cc.nombre ASC`
    );
    const convocadosPorCitacion = new Map();
    convocadosRes.rows.forEach((c) => {
      const lista = convocadosPorCitacion.get(c.citacion_id) || [];
      lista.push(c);
      convocadosPorCitacion.set(c.citacion_id, lista);
    });
    const citaciones = citacionesRes.rows.map((c) => ({ ...c, convocados: convocadosPorCitacion.get(c.id) || [] }));

    const permisos = await resolverPermisosDeActor(req.actor);
    const esAdminOSuper = ['admin', 'super_admin', 'superadmin'].includes(normalizarRol(req.actor.rol));
    if (permisos.citaciones && esAdminOSuper) {
      return res.json(citaciones);
    }
    if (permisos.citaciones) {
      const rutActor = normalizarRutParaComparar(req.actor.rut);
      return res.json(citaciones.filter((c) => normalizarRutParaComparar(c.responsable_rut) === rutActor));
    }

    const pupilos = await obtenerPupilosDeActor(req.actor);
    const visibles = citaciones.filter((c) => citacionEsVisibleParaPupilos(c, pupilos));
    res.json(visibles);
  } catch (err) {
    console.error('[GET /api/citaciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: detalle de una citación (mismas reglas de visibilidad que la lista).
app.get('/api/citaciones/:id', authenticate, async (req, res) => {
  try {
    await barrerCitacionesVencidas();

    const citacion = await cargarCitacionConConvocados(req.params.id);
    if (!citacion) return res.status(404).json({ error: 'Citación no encontrada.' });

    const permisos = await resolverPermisosDeActor(req.actor);
    const esAdminOSuper = ['admin', 'super_admin', 'superadmin'].includes(normalizarRol(req.actor.rol));
    if (permisos.citaciones && esAdminOSuper) {
      return res.json(citacion);
    }
    if (permisos.citaciones) {
      const rutActor = normalizarRutParaComparar(req.actor.rut);
      if (normalizarRutParaComparar(citacion.responsable_rut) !== rutActor) {
        return res.status(403).json({ error: 'No tienes acceso a esta citación.' });
      }
      return res.json(citacion);
    }

    const pupilos = await obtenerPupilosDeActor(req.actor);
    if (!citacionEsVisibleParaPupilos(citacion, pupilos)) {
      return res.status(403).json({ error: 'No tienes acceso a esta citación.' });
    }
    res.json(citacion);
  } catch (err) {
    console.error('[GET /api/citaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: edita los datos de una citación existente (fecha, rival, horarios,
// etc). No toca la nómina de convocados, que se gestiona aparte vía
// /convocados. Solo admin/super_admin o quien la creó pueden editarla.
app.put('/api/citaciones/:id', authenticate, requireModule('citaciones'), async (req, res) => {
  const {
    tipo_competencia, competencia_nombre, competencia_logo_url,
    dia_citacion, hora_citacion, hora_presentacion, hora_maxima_confirmacion,
    rival_nombre, rival_logo_url,
    rama, categoria_base, categorias_apoyo,
  } = req.body;

  try {
    const existente = await pool.query('SELECT responsable_rut FROM citaciones WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Citación no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin', 'superadmin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper && normalizarRutParaComparar(existente.rows[0].responsable_rut) !== normalizarRutParaComparar(req.actor.rut)) {
      return res.status(403).json({ error: 'No puedes editar una citación creada por otra persona.' });
    }

    await pool.query(
      `UPDATE citaciones
       SET tipo_competencia = COALESCE($1, tipo_competencia),
           competencia_nombre = COALESCE($2, competencia_nombre),
           competencia_logo_url = COALESCE($3, competencia_logo_url),
           dia_citacion = COALESCE($4, dia_citacion),
           hora_citacion = COALESCE($5, hora_citacion),
           hora_presentacion = COALESCE($6, hora_presentacion),
           hora_maxima_confirmacion = COALESCE($7, hora_maxima_confirmacion),
           rival_nombre = COALESCE($8, rival_nombre),
           rival_logo_url = COALESCE($9, rival_logo_url),
           rama = COALESCE($10, rama),
           categoria_base = COALESCE($11, categoria_base),
           categorias_apoyo = COALESCE($12, categorias_apoyo),
           updated_at = NOW()
       WHERE id = $13`,
      [
        tipo_competencia || null, competencia_nombre || null, competencia_logo_url || null,
        dia_citacion || null, hora_citacion || null, hora_presentacion || null,
        hora_maxima_confirmacion || null,
        rival_nombre || null, rival_logo_url || null,
        rama || null, categoria_base || null,
        Array.isArray(categorias_apoyo) ? JSON.stringify(categorias_apoyo) : null,
        req.params.id,
      ]
    );

    const completa = await cargarCitacionConConvocados(req.params.id);
    res.json(completa);
  } catch (err) {
    console.error('[PUT /api/citaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: borra una citación completa. citacion_convocados se limpia solo
// (ON DELETE CASCADE), pero comunicaciones.citacion_id no tiene FK (ver nota
// junto a ensureComunicacionesExtendedColumns) así que el post del muro
// vinculado se borra a mano, igual que en /api/academia-videos/:id. Solo
// admin/super_admin o quien la creó pueden borrarla.
app.delete('/api/citaciones/:id', authenticate, requireModule('citaciones'), async (req, res) => {
  const client = await pool.connect();
  try {
    const existente = await client.query('SELECT responsable_rut FROM citaciones WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Citación no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin', 'superadmin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper && normalizarRutParaComparar(existente.rows[0].responsable_rut) !== normalizarRutParaComparar(req.actor.rut)) {
      return res.status(403).json({ error: 'No puedes borrar una citación creada por otra persona.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM comunicaciones WHERE citacion_id = $1', [req.params.id]);
    await client.query('DELETE FROM citaciones WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DELETE /api/citaciones/:id]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST: agrega un convocado a una citación existente y lo notifica.
app.post('/api/citaciones/:id/convocados', authenticate, requireModule('citaciones'), async (req, res) => {
  const { rut_jugador, nombre, rama, categoria, correo_apoderado, requiere_excepcion_morosidad } = req.body;
  if (!String(rut_jugador || '').trim()) {
    return res.status(400).json({ error: 'Falta el RUT del deportista.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO citacion_convocados
        (citacion_id, rut_jugador, nombre, rama, categoria, correo_apoderado, requiere_excepcion_morosidad, estado_excepcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 THEN 'solicitada' ELSE 'no_requiere' END)
       ON CONFLICT (citacion_id, rut_jugador) DO NOTHING
       RETURNING *`,
      [req.params.id, rut_jugador, nombre || '', rama || '', categoria || '', correo_apoderado || null, Boolean(requiere_excepcion_morosidad)]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Ese deportista ya está en la nómina.' });
    }

    const citacion = await pool.query('SELECT tipo_competencia, competencia_nombre, rival_nombre, dia_citacion, hora_presentacion FROM citaciones WHERE id = $1', [req.params.id]);
    const destinatarios = await resolverDestinatariosCitacion([{ rut_jugador, correo_apoderado }]);
    const titulo = `Citación ${citacion.rows[0]?.tipo_competencia || ''}: ${citacion.rows[0]?.competencia_nombre || ''}`.trim();
    const cuerpo = `Convocatoria vs ${citacion.rows[0]?.rival_nombre || ''}. Día ${formatearFechaCitacion(citacion.rows[0]?.dia_citacion)}, presentación ${citacion.rows[0]?.hora_presentacion || '-'}.`;
    await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
      rut, tipo: 'citacion', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: Number(req.params.id),
    })));

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/citaciones/:id/convocados]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: quita un convocado de la nómina.
app.delete('/api/citaciones/:id/convocados/:rut', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM citacion_convocados WHERE citacion_id = $1 AND rut_jugador = $2',
      [req.params.id, req.params.rut]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/citaciones/:id/convocados/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH: confirma/rechaza la citación — solo el apoderado registrado del
// deportista puede responder (ni admin ni staff responden en su lugar).
// respuesta es opcional: el apoderado puede guardar solo un mensaje al
// profesor (o corregir la justificación) sin volver a confirmar/rechazar.
app.patch('/api/citaciones/:id/convocados/:rut/rsvp', authenticate, requireApoderadoDeJugador(pool), async (req, res) => {
  const { respuesta, justificacion, mensaje_profesor, excepcion_solicitada } = req.body;
  const hayRespuesta = respuesta !== undefined && respuesta !== null;

  if (hayRespuesta && !['si', 'no'].includes(respuesta)) {
    return res.status(400).json({ error: 'Respuesta inválida: debe ser "si" o "no".' });
  }
  if (respuesta === 'no' && !String(justificacion || '').trim()) {
    return res.status(400).json({ error: 'Debes indicar una justificación para rechazar la citación.' });
  }
  if (!hayRespuesta && mensaje_profesor === undefined && justificacion === undefined) {
    return res.status(400).json({ error: 'No hay ningún cambio para guardar.' });
  }

  const excepcionProvista = excepcion_solicitada === undefined || excepcion_solicitada === null
    ? null
    : Boolean(excepcion_solicitada);

  try {
    const result = await pool.query(
      `UPDATE citacion_convocados SET
        respuesta = COALESCE($1, respuesta),
        justificacion = COALESCE($2, justificacion),
        mensaje_profesor = COALESCE($3, mensaje_profesor),
        excepcion_solicitada = COALESCE($4, excepcion_solicitada),
        estado_excepcion = CASE WHEN $4 THEN 'solicitada' ELSE estado_excepcion END,
        respondido_automaticamente = CASE WHEN $1 IS NOT NULL THEN false ELSE respondido_automaticamente END,
        actualizado_en = NOW()
       WHERE citacion_id = $5 AND rut_jugador = $6
       RETURNING *`,
      [hayRespuesta ? respuesta : null, justificacion || null, mensaje_profesor || null, excepcionProvista, req.params.id, req.params.rut]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ese convocado en la citación.' });
    }
    const convocado = result.rows[0];

    // Notifica al profesor que creó la citación y a todo admin/superadmin —
    // solo cuando esta llamada realmente cambió sí/no (no en un guardado de
    // solo mensaje_profesor).
    if (hayRespuesta) {
      const citacionInfo = (await pool.query(
        'SELECT responsable_rut, tipo_competencia, competencia_nombre, rival_nombre, dia_citacion FROM citaciones WHERE id = $1',
        [req.params.id]
      )).rows[0];
      const destinatarios = await resolverDestinatariosRSVP(citacionInfo?.responsable_rut);
      const estado = convocado.respuesta === 'si'
        ? 'confirmó asistencia'
        : `rechazó la citación (${convocado.justificacion ? 'con justificación' : 'sin justificación'})`;
      const titulo = `Respuesta de citación: ${convocado.nombre || req.params.rut}`;
      const cuerpo = `${convocado.nombre || 'El deportista'} ${estado} — ${citacionInfo?.tipo_competencia || ''} ${citacionInfo?.competencia_nombre || ''} vs ${citacionInfo?.rival_nombre || ''} (${formatearFechaCitacion(citacionInfo?.dia_citacion)}).`;
      await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
        rut, tipo: 'citacion_rsvp', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: Number(req.params.id),
      })));
    }

    res.json(convocado);
  } catch (err) {
    console.error('[PATCH /api/citaciones/:id/convocados/:rut/rsvp]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: notificaciones in-app del actor autenticado.
app.get('/api/notificaciones', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notificaciones_app WHERE REPLACE(REPLACE(UPPER(rut_destinatario), '.', ''), '-', '') = $1
       ORDER BY creado_en DESC LIMIT 100`,
      [normalizarRutParaComparar(req.actor.rut)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/notificaciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH: marca una notificación propia como leída.
app.patch('/api/notificaciones/:id/leida', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notificaciones_app SET leida = true
       WHERE id = $1 AND REPLACE(REPLACE(UPPER(rut_destinatario), '.', ''), '-', '') = $2
       RETURNING *`,
      [req.params.id, normalizarRutParaComparar(req.actor.rut)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PATCH /api/notificaciones/:id/leida]', err);
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
    console.error('[GET /api/eventos]', err);
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
    console.error('[POST /api/eventos]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. ENDPOINTS: ASISTENCIA (FASE 1)
// ==========================================

// GET: Asistencia
// GET: lista de sesiones de asistencia (una fila por "pasar lista"), con
// conteos agregados — base del resumen filtrable por rama/categoría/profesor.
app.get('/api/asistencia/sesiones', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  const { rama, categoria, entrenador, desde, hasta } = req.query;
  try {
    const condiciones = [];
    const valores = [];
    if (rama && rama !== 'todas') {
      valores.push(rama);
      condiciones.push(`rama = $${valores.length}`);
    }
    if (categoria) {
      valores.push(categoria);
      condiciones.push(`categoria = $${valores.length}`);
    }
    if (entrenador) {
      valores.push(`%${entrenador}%`);
      condiciones.push(`entrenador_cargo ILIKE $${valores.length}`);
    }
    if (desde) {
      valores.push(desde);
      condiciones.push(`fecha >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(hasta);
      condiciones.push(`fecha <= $${valores.length}`);
    }
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
        sesion_id, fecha, rama, entrenador_cargo, hora_inicio, hora_fin,
        array_agg(DISTINCT categoria) FILTER (WHERE categoria IS NOT NULL AND categoria != '') AS categorias,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado_asistencia = 'presente') AS presentes,
        COUNT(*) FILTER (WHERE estado_asistencia = 'ausente') AS ausentes,
        COUNT(*) FILTER (WHERE estado_asistencia = 'justificado') AS justificados,
        MAX(created_at) AS creado_en
       FROM asistencia
       ${where}
       GROUP BY sesion_id, fecha, rama, entrenador_cargo, hora_inicio, hora_fin
       ORDER BY fecha DESC, creado_en DESC`,
      valores
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/asistencia/sesiones]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: detalle de una sesión (una fila por jugador).
app.get('/api/asistencia/sesiones/:sesionId', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM asistencia WHERE sesion_id = $1 ORDER BY nombre_jugador ASC`,
      [req.params.sesionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/asistencia/sesiones/:sesionId]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: registra una sesión completa de una sola vez (todo el roster de esa
// pasada de lista), en una transacción con un sesion_id común.
app.post('/api/asistencia/sesion', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  const { fecha, rama, hora_inicio, hora_fin, entrenador_cargo, registros } = req.body;
  if (!Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ error: 'No hay registros de asistencia para guardar.' });
  }

  const sesionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const registro of registros) {
      await client.query(
        `INSERT INTO asistencia
          (sesion_id, fecha, rama, categoria, rut_jugador, nombre_jugador, estado_asistencia, observacion, entrenador_cargo, hora_inicio, hora_fin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          sesionId, fecha || null, rama || null, registro.categoria || null,
          registro.rut_jugador || null, registro.nombre_jugador || '', registro.estado_asistencia || 'pendiente',
          registro.observacion || null, entrenador_cargo || null, hora_inicio || null, hora_fin || null,
        ]
      );
    }
    await client.query('COMMIT');
    const creada = await pool.query('SELECT * FROM asistencia WHERE sesion_id = $1 ORDER BY nombre_jugador ASC', [sesionId]);
    res.status(201).json({ sesion_id: sesionId, registros: creada.rows });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/asistencia/sesion]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT: corrige el estado/observación de un jugador dentro de una sesión ya guardada.
app.put('/api/asistencia/:id', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  const { estado_asistencia, observacion } = req.body;
  try {
    const result = await pool.query(
      `UPDATE asistencia SET
        estado_asistencia = COALESCE($1, estado_asistencia),
        observacion = COALESCE($2, observacion),
        updated_at = NOW()
       WHERE id_asistencia = $3
       RETURNING *`,
      [estado_asistencia || null, observacion, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de asistencia no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/asistencia/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: borra un registro individual (un jugador dentro de una sesión).
app.delete('/api/asistencia/:id', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  try {
    await pool.query('DELETE FROM asistencia WHERE id_asistencia = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/asistencia/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: borra una sesión completa (toda una pasada de lista).
app.delete('/api/asistencia/sesiones/:sesionId', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  try {
    await pool.query('DELETE FROM asistencia WHERE sesion_id = $1', [req.params.sesionId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/asistencia/sesiones/:sesionId]', err);
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
    console.error('[GET /api/partidos-live]', err);
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
    console.error('[GET /api/partidos-live/historial]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear partido
app.post('/api/partidos-live', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'resultados'), async (req, res) => {
  const {
    fecha_hora, cancha_sede, categoria_rama, rama, categoria, equipo_local, equipo_visitante,
    rut_planillero, estado_juego,
    logo_local_url, logo_visitante_url, torneo_nombre, torneo_logo_url, id_torneo,
    pts_local, pts_visitante, publicado,
  } = req.body;
  try {
    // Use new rama/categoria if provided, otherwise use old categoria_rama for backward compatibility
    const ramafinal = rama || 'Mixta';
    const categoriafinal = categoria || 'SUB-13';
    const categoria_rama_final = categoria_rama || `${ramafinal}-${categoriafinal}`;

    const result = await pool.query(
      `INSERT INTO partidos_live
       (fecha_hora, cancha_sede, categoria_rama, rama, categoria, equipo_local, equipo_visitante, rut_planillero,
        estado_juego, logo_local_url, logo_visitante_url, torneo_nombre, torneo_logo_url, id_torneo,
        pts_local, pts_visitante, publicado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9,'pendiente'), $10, $11, $12, $13, $14,
        COALESCE($15, 0), COALESCE($16, 0), COALESCE($17, true))
       RETURNING *`,
      [
        fecha_hora, cancha_sede, categoria_rama_final, ramafinal, categoriafinal,
        equipo_local, equipo_visitante, rut_planillero || null,
        estado_juego || 'pendiente',
        logo_local_url || null, logo_visitante_url || null,
        torneo_nombre || null, torneo_logo_url || null, id_torneo || null,
        pts_local ?? 0, pts_visitante ?? 0, publicado,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/partidos-live]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar marcador
app.put('/api/partidos-live/:id', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'resultados'), async (req, res) => {
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
    id_torneo,
    publicado,
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
           id_torneo = COALESCE($16, id_torneo),
           publicado = COALESCE($17, publicado),
           updated_at = NOW()
       WHERE id_partido = $18
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
        id_torneo,
        publicado,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/partidos-live/:id]', err);
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
    id_torneo,
    publicado,
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
           id_torneo = COALESCE($11, id_torneo),
           publicado = COALESCE($12, publicado),
           updated_at = NOW()
       WHERE id_partido = $13
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
        id_torneo || null,
        publicado,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/partidos-live/:id/finalizar-mesa]', err);
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
    console.error('[DELETE /api/partidos-live/:id]', err);
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
    console.error('[GET /api/estadisticas/partido/:partidoId]', err);
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
    console.error('[POST /api/estadisticas]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 16. ENDPOINTS: EVALUACIONES (FASE 2)
// ==========================================

// GET: Evaluaciones de un jugador. Staff/admin/superadmin ven cualquiera;
// el resto (apoderado, jugador, socio, etc.) solo puede ver las de sus
// propios pupilos — antes cualquiera con el módulo 'jugador' podía leer las
// evaluaciones de CUALQUIER rut solo cambiando el parámetro de la URL.
app.get('/api/evaluaciones/jugador/:rut', authenticate, requireAnyModule('evaluacion_staff', 'jugador'), async (req, res) => {
  try {
    if (ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(req.actor.rol))) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      if (!pupilos.some((p) => normalizarRutParaComparar(p.rut_jugador) === normalizarRutParaComparar(req.params.rut))) {
        return res.status(403).json({ error: 'No tienes acceso a las evaluaciones de ese deportista.' });
      }
    }
    const result = await pool.query(
      `SELECT * FROM evaluaciones WHERE rut_jugador = $1 ORDER BY fecha_evaluacion DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/evaluaciones/jugador/:rut]', err);
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
    console.error('[POST /api/evaluaciones]', err);
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
    console.error('[GET /api/gamificacion/:rut]', err);
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
    console.error('[POST /api/gamificacion]', err);
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
    console.error('[GET /api/marcas/:rut]', err);
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
    console.error('[POST /api/marcas]', err);
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
    console.error('[GET /api/resultados/partido/:partidoId]', err);
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
    console.error('[POST /api/resultados]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 20. ENDPOINTS: QUIZ (FASE 2)
// ==========================================

// GET: Todas las preguntas
// Staff/super_admin ven todas las preguntas activas (para gestionarlas). El
// resto solo ve las dirigidas a la rama/categoría de sus propios pupilos.
app.get('/api/quiz', authenticate, requireModule('academia'), async (req, res) => {
  try {
    const esProfesor = ['staff', 'super_admin'].includes(normalizarRol(req.actor.rol));
    const result = await pool.query(
      `SELECT * FROM quiz_preguntas WHERE activo = true ORDER BY dificultad ASC`
    );
    if (esProfesor) {
      return res.json(result.rows);
    }
    const pupilos = await obtenerPupilosDeActor(req.actor);
    res.json(result.rows.filter((q) => academiaContenidoEsVisibleParaPupilos(q, pupilos)));
  } catch (err) {
    console.error('[GET /api/quiz]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pregunta. requireRole en vez de requireModule('academia'): ese
// módulo también lo tienen jugadores/apoderados, que antes podían crear
// preguntas llamando la API directo aunque ninguna pantalla lo permitiera.
app.post('/api/quiz', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad, categorias_objetivo } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO quiz_preguntas (titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad, categorias_objetivo, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        titulo, tipo_quiz, rama, pregunta, JSON.stringify(opciones_json), respuesta_correcta, dificultad,
        JSON.stringify(categorias_objetivo || []), req.actor.rut,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/quiz]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT/DELETE: la PK real de quiz_preguntas es id_pregunta (no id) — la ruta
// usa :id por convención pero filtra por id_pregunta. A diferencia de
// materiales/videos/pizarras (dueño o admin), el quiz lo puede editar/borrar
// cualquier staff/admin/superadmin — con pocas cuentas de staff en el club,
// tiene más sentido que el banco de preguntas se mantenga entre todos.
app.put('/api/quiz/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { titulo, tipo_quiz, rama, categorias_objetivo, pregunta, opciones_json, respuesta_correcta, dificultad, activo } = req.body;
  try {
    const existente = await pool.query('SELECT id_pregunta FROM quiz_preguntas WHERE id_pregunta = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
    const result = await pool.query(
      `UPDATE quiz_preguntas SET
         titulo = COALESCE($1, titulo), tipo_quiz = COALESCE($2, tipo_quiz), rama = COALESCE($3, rama),
         categorias_objetivo = COALESCE($4::jsonb, categorias_objetivo), pregunta = COALESCE($5, pregunta),
         opciones_json = COALESCE($6::json, opciones_json), respuesta_correcta = COALESCE($7, respuesta_correcta),
         dificultad = COALESCE($8, dificultad), activo = COALESCE($9, activo), updated_at = NOW()
       WHERE id_pregunta = $10
       RETURNING *`,
      [
        titulo ?? null, tipo_quiz ?? null, rama ?? null,
        categorias_objetivo !== undefined ? JSON.stringify(categorias_objetivo) : null,
        pregunta ?? null, opciones_json !== undefined ? JSON.stringify(opciones_json) : null,
        respuesta_correcta ?? null, dificultad ?? null,
        activo !== undefined ? Boolean(activo) : null,
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/quiz/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/quiz/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const existente = await pool.query('SELECT id_pregunta FROM quiz_preguntas WHERE id_pregunta = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
    await pool.query('DELETE FROM quiz_preguntas WHERE id_pregunta = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/quiz/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: registra la respuesta de un jugador a una pregunta (una sola vez por
// pregunta+jugador vía UNIQUE+ON CONFLICT — reintentar tras refrescar la
// página no duplica ni vuelve a otorgar puntos). Reemplaza el flujo anterior
// donde el frontend llamaba POST /api/gamificacion por separado sin dejar
// registro de a qué pregunta correspondía la respuesta.
app.post('/api/quiz/:id/responder', authenticate, requireModule('academia'), async (req, res) => {
  const { rut_jugador, opcion_seleccionada } = req.body;
  const rutJugador = String(rut_jugador || '').trim();
  if (!rutJugador || !opcion_seleccionada) {
    return res.status(400).json({ error: 'Falta el deportista o la opción elegida.' });
  }
  try {
    const rolNormalizado = normalizarRol(req.actor.rol);
    if (ROLES_JUGADORES_ACOTADOS.includes(rolNormalizado)) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      if (!pupilos.some((p) => normalizarRutParaComparar(p.rut_jugador) === normalizarRutParaComparar(rutJugador))) {
        return res.status(403).json({ error: 'No puedes responder por ese deportista.' });
      }
    }

    const pregunta = (await pool.query(
      'SELECT id_pregunta, titulo, respuesta_correcta FROM quiz_preguntas WHERE id_pregunta = $1 AND activo = true',
      [req.params.id]
    )).rows[0];
    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }

    const esCorrecta = opcion_seleccionada === pregunta.respuesta_correcta;
    const puntos = esCorrecta ? 50 : 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertado = await client.query(
        `INSERT INTO quiz_respuestas (id_pregunta, rut_jugador, opcion_seleccionada, es_correcta, puntos_obtenidos, respondido_por)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id_pregunta, rut_jugador) DO NOTHING
         RETURNING *`,
        [req.params.id, rutJugador, opcion_seleccionada, esCorrecta, puntos, req.actor.rut]
      );

      if (insertado.rows.length === 0) {
        await client.query('ROLLBACK');
        const previa = (await pool.query(
          'SELECT * FROM quiz_respuestas WHERE id_pregunta = $1 AND rut_jugador = $2',
          [req.params.id, rutJugador]
        )).rows[0];
        return res.json({ ...previa, duplicado: true });
      }

      if (esCorrecta) {
        await client.query(
          `INSERT INTO gamificacion_puntos (rut_jugador, tipo_logro, puntos_obtenidos, descripcion)
           VALUES ($1, 'quiz_correcto', $2, $3)`,
          [rutJugador, puntos, `Respuesta correcta: ${pregunta.titulo || 'Quiz'}`]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ ...insertado.rows[0], duplicado: false });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[POST /api/quiz/:id/responder]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: respuestas de una pregunta + quiénes de la audiencia objetivo (misma
// rama/categoría, vía academiaContenidoEsVisibleParaPupilos) todavía no
// respondieron. Uso exclusivo del dashboard de staff.
app.get('/api/quiz/:id/respuestas', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const pregunta = (await pool.query('SELECT * FROM quiz_preguntas WHERE id_pregunta = $1', [req.params.id])).rows[0];
    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }

    const respuestas = (await pool.query(
      `SELECT qr.*, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria
       FROM quiz_respuestas qr
       JOIN jugadores j ON j.rut_jugador = qr.rut_jugador
       WHERE qr.id_pregunta = $1
       ORDER BY qr.created_at ASC`,
      [req.params.id]
    )).rows;

    const todosJugadores = (await pool.query('SELECT rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria FROM jugadores')).rows;
    const rutsQueRespondieron = new Set(respuestas.map((r) => normalizarRutParaComparar(r.rut_jugador)));
    const audiencia = todosJugadores.filter((j) => academiaContenidoEsVisibleParaPupilos(pregunta, [{ rut_jugador: j.rut_jugador, rama: j.rama, categoria: j.categoria }]));
    const pendientes = audiencia.filter((j) => !rutsQueRespondieron.has(normalizarRutParaComparar(j.rut_jugador)));

    res.json({
      pregunta,
      respuestas,
      pendientes,
      resumen: {
        totalAudiencia: audiencia.length,
        totalRespondieron: respuestas.length,
        totalCorrectas: respuestas.filter((r) => r.es_correcta).length,
        totalIncorrectas: respuestas.filter((r) => !r.es_correcta).length,
      },
    });
  } catch (err) {
    console.error('[GET /api/quiz/:id/respuestas]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: registra que un jugador abrió/reprodujo un material de Academia
// (video interno o link externo). Fire-and-forget desde el frontend, no
// otorga puntos — solo mide alcance real. ON CONFLICT DO NOTHING = idempotente
// aunque se dispare más de una vez para el mismo material/jugador.
app.post('/api/academia-material-interacciones', authenticate, requireModule('academia'), async (req, res) => {
  const { comunicacion_id, rut_jugador } = req.body;
  const rutJugador = String(rut_jugador || '').trim();
  const comunicacionId = Number(comunicacion_id);
  if (!rutJugador || !Number.isFinite(comunicacionId)) {
    return res.status(400).json({ error: 'Falta el material o el deportista.' });
  }
  try {
    const rolNormalizado = normalizarRol(req.actor.rol);
    if (ROLES_JUGADORES_ACOTADOS.includes(rolNormalizado)) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      if (!pupilos.some((p) => normalizarRutParaComparar(p.rut_jugador) === normalizarRutParaComparar(rutJugador))) {
        return res.status(403).json({ error: 'No puedes registrar interacción por ese deportista.' });
      }
    }
    const result = await pool.query(
      `INSERT INTO academia_material_interacciones (comunicacion_id, rut_jugador)
       VALUES ($1, $2)
       ON CONFLICT (comunicacion_id, rut_jugador) DO NOTHING
       RETURNING *`,
      [comunicacionId, rutJugador]
    );
    res.status(201).json({ ok: true, duplicado: result.rows.length === 0 });
  } catch (err) {
    console.error('[POST /api/academia-material-interacciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: quiénes interactuaron con un material + quiénes de la audiencia
// objetivo todavía no. Uso exclusivo del dashboard de staff.
app.get('/api/academia-material-interacciones/:comunicacionId', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const material = (await pool.query('SELECT * FROM comunicaciones WHERE id = $1', [req.params.comunicacionId])).rows[0];
    if (!material || !String(material.tipo || '').toLowerCase().startsWith('academia-')) {
      return res.status(404).json({ error: 'Material no encontrado.' });
    }

    const interacciones = (await pool.query(
      `SELECT ai.*, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria
       FROM academia_material_interacciones ai
       JOIN jugadores j ON j.rut_jugador = ai.rut_jugador
       WHERE ai.comunicacion_id = $1
       ORDER BY ai.primera_apertura ASC`,
      [req.params.comunicacionId]
    )).rows;

    const todosJugadores = (await pool.query('SELECT rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria FROM jugadores')).rows;
    const rutsQueInteractuaron = new Set(interacciones.map((r) => normalizarRutParaComparar(r.rut_jugador)));
    const audiencia = todosJugadores.filter((j) => academiaContenidoEsVisibleParaPupilos(material, [{ rut_jugador: j.rut_jugador, rama: j.rama, categoria: j.categoria }]));
    const pendientes = audiencia.filter((j) => !rutsQueInteractuaron.has(normalizarRutParaComparar(j.rut_jugador)));

    res.json({
      material,
      interacciones,
      pendientes,
      resumen: { totalAudiencia: audiencia.length, totalInteractuaron: interacciones.length },
    });
  } catch (err) {
    console.error('[GET /api/academia-material-interacciones/:comunicacionId]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: ranking de puntos/nivel por jugador, filtrable por rama/categoría.
// LEFT JOIN para que también aparezcan jugadores con 0 puntos (no solo los
// que ya tienen registros en gamificacion_puntos).
app.get('/api/academia/ranking', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const rama = String(req.query.rama || '').trim() || null;
    const categoria = String(req.query.categoria || '').trim() || null;
    const result = await pool.query(
      `SELECT j.rut_jugador, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria,
              COALESCE(SUM(gp.puntos_obtenidos), 0) AS xp_total,
              COUNT(gp.id_logro) AS logros_totales
       FROM jugadores j
       LEFT JOIN gamificacion_puntos gp ON gp.rut_jugador = j.rut_jugador
       WHERE ($1::text IS NULL OR j.rama = $1) AND ($2::text IS NULL OR j.categoria = $2)
       GROUP BY j.rut_jugador, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria
       ORDER BY xp_total DESC, j.apellido_paterno ASC`,
      [rama, categoria]
    );
    const filas = result.rows.map((fila, idx) => ({
      ...fila,
      xp_total: Number(fila.xp_total),
      posicion: idx + 1,
      nivel: calcularNivelDesdeXPTotal(fila.xp_total),
    }));
    res.json(filas);
  } catch (err) {
    console.error('[GET /api/academia/ranking]', err);
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
    console.error('[GET /api/pizarra/partido/:partidoId]', err);
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
    console.error('[POST /api/pizarra]', err);
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
    console.error('[GET /api/migracion-pagos]', err);
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
    console.error('[POST /api/migracion-pagos]', err);
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
    console.error('[GET /api/jugadores-visita]', err);
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
    console.error('[POST /api/jugadores-visita]', err);
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
    console.error('[PUT /api/jugadores-visita/:id]', err);
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
    console.error('[GET /api/auditoria]', err);
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
    console.error('[GET /api/staff]', err);
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
    console.error('[POST /api/staff]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 26. ENDPOINTS: TORNEOS (FASE 3)
// ==========================================

// Lectura pública (mismo criterio que GET /api/partidos-live y GET
// /api/resultados/partido/:id): cualquiera puede ver qué torneos existen y su
// tabla de posiciones, incluso sin sesión, para mostrarlo en la fachada
// pública. Crear/editar torneos sigue exigiendo admin o staff con Mesa.
app.get('/api/torneos', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM torneos ORDER BY fecha_inicio DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/torneos]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/torneos', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard'), async (req, res) => {
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
    console.error('[POST /api/torneos]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: tabla de posiciones de un torneo, calculada desde los partidos
// finalizados asignados a él. Básquetbol no tiene empates: se ordena por
// victorias, luego % de victorias (por si no todos jugaron la misma
// cantidad de partidos), luego diferencia de puntos. Pública, igual que
// GET /api/torneos.
app.get('/api/torneos/:id/tabla-posiciones', async (req, res) => {
  try {
    const partidos = (await pool.query(
      `SELECT id_partido, equipo_local, equipo_visitante, pts_local, pts_visitante, fecha_hora, cancha_sede
       FROM partidos_live
       WHERE id_torneo = $1 AND estado_juego = 'finalizado'
       ORDER BY fecha_hora ASC`,
      [req.params.id]
    )).rows;

    const partidosPendientes = (await pool.query(
      `SELECT id_partido, equipo_local, equipo_visitante, fecha_hora, cancha_sede, estado_juego
       FROM partidos_live
       WHERE id_torneo = $1 AND estado_juego != 'finalizado'
       ORDER BY fecha_hora ASC`,
      [req.params.id]
    )).rows;

    const normalizar = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const tabla = new Map();
    const upsert = (nombre, pf, pc, resultado) => {
      const key = normalizar(nombre);
      if (!key) return;
      const fila = tabla.get(key) || { nombre: String(nombre || '').trim(), pj: 0, pg: 0, pp: 0, pf: 0, pc: 0 };
      fila.pj += 1;
      fila.pf += Number(pf) || 0;
      fila.pc += Number(pc) || 0;
      if (resultado === 'W') fila.pg += 1;
      else if (resultado === 'L') fila.pp += 1;
      tabla.set(key, fila);
    };

    for (const p of partidos) {
      const ptsLocal = Number(p.pts_local) || 0;
      const ptsVisitante = Number(p.pts_visitante) || 0;
      const empate = ptsLocal === ptsVisitante;
      upsert(p.equipo_local, ptsLocal, ptsVisitante, empate ? null : (ptsLocal > ptsVisitante ? 'W' : 'L'));
      upsert(p.equipo_visitante, ptsVisitante, ptsLocal, empate ? null : (ptsVisitante > ptsLocal ? 'W' : 'L'));
    }

    const posiciones = [...tabla.values()]
      .map((fila) => ({ ...fila, dif: fila.pf - fila.pc, pct: fila.pj ? fila.pg / fila.pj : 0 }))
      .sort((a, b) => b.pg - a.pg || b.pct - a.pct || b.dif - a.dif)
      .map((fila, idx) => ({ ...fila, posicion: idx + 1 }));

    res.json({ posiciones, partidos, partidosPendientes });
  } catch (err) {
    console.error('[GET /api/torneos/:id/tabla-posiciones]', err);
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
    console.error('[GET /api/caja-evento/:eventoId]', err);
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
    console.error('[POST /api/caja-evento]', err);
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
    console.error('[GET /api/inventario]', err);
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
    console.error('[POST /api/inventario]', err);
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
    console.error('[GET /api/egresos]', err);
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
    console.error('[POST /api/egresos]', err);
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
    console.error('[GET /api/kiosco-productos]', err);
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
    console.error('[POST /api/kiosco-productos]', err);
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
    console.error('[PUT /api/kiosco-productos/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// Baja lógica (activo=false) en vez de DELETE físico: conserva la trazabilidad
// de kiosco_ventas.producto_id de ventas históricas de ese producto.
app.delete('/api/kiosco-productos/:id', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE kiosco_productos SET activo = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/kiosco-productos/:id]', err);
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
    console.error('[GET /api/kiosco-turnos/actual]', err);
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
    console.error('[GET /api/kiosco-turnos]', err);
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
    console.error('[POST /api/kiosco-turnos]', err);
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
    console.error('[PUT /api/kiosco-turnos/:id/cerrar]', err);
    res.status(500).json({ error: err.message });
  }
});

// Solo permite borrar turnos ya cerrados (el actual/abierto no se puede eliminar
// desde el historial). Las ventas/egresos asociados no se borran: quedan con
// turno_id en null (ON DELETE SET NULL), preservando el registro de cada venta.
app.delete('/api/kiosco-turnos/:id', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM kiosco_turnos WHERE id = $1 AND estado = 'cerrado' RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado o no está cerrado (no se puede borrar el turno activo).' });
    }
    res.json({ ok: true, deleted: { id: result.rows[0].id } });
  } catch (err) {
    console.error('[DELETE /api/kiosco-turnos/:id]', err);
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
    console.error('[GET /api/kiosco-ventas]', err);
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
    console.error('[POST /api/kiosco-ventas]', err);
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
    console.error('[DELETE /api/kiosco-ventas]', err);
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
    console.error('[GET /api/kiosco-fiados]', err);
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
    console.error('[POST /api/kiosco-fiados/cargo]', err);
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
    console.error('[POST /api/kiosco-fiados/:id/pago]', err);
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
    console.error('[GET /api/kiosco-egresos]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kiosco-egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id, descripcion, monto, nombre_receptor, apellido_receptor, rut_receptor, firma_receptor } = req.body;
  if (!descripcion || !monto) {
    return res.status(400).json({ error: 'Descripción y monto son obligatorios.' });
  }
  if (!String(nombre_receptor || '').trim() || !String(apellido_receptor || '').trim() || !String(rut_receptor || '').trim() || !firma_receptor) {
    return res.status(400).json({ error: 'Para registrar un egreso se requiere nombre, apellido, RUT y firma de quien recibe.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO kiosco_egresos (turno_id, descripcion, monto, nombre_receptor, apellido_receptor, rut_receptor, firma_receptor)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [turno_id || null, descripcion, monto, nombre_receptor.trim(), apellido_receptor.trim(), rut_receptor.trim(), firma_receptor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/kiosco-egresos]', err);
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
    console.error('[GET /api/clubes]', err);
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
    console.error('[POST /api/clubes]', err);
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
    console.error('[GET /api/lesiones]', err);
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
    console.error('[POST /api/lesiones]', err);
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
    console.error('[GET /api/disciplina]', err);
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
    console.error('[POST /api/disciplina]', err);
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
    console.error('[GET /api/entrenamientos]', err);
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
    console.error('[POST /api/entrenamientos]', err);
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
    console.error('[GET /api/encuestas/:encuestaId/respuestas]', err);
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
    console.error('[POST /api/encuestas/:encuestaId/respuesta]', err);
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
    console.error('[GET /api/asistencia-eventos/:eventoId]', err);
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
    console.error('[POST /api/asistencia-eventos]', err);
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

  ensureJugadoresExtendedColumns().catch((error) => {
    console.error('❌ Error verificando columnas extendidas de jugadores:', error.message);
  });

  ensureJugadoresBecaNumerica().catch((error) => {
    console.error('❌ Error migrando columna beca a porcentaje:', error.message);
  });

  ensureBecaRevisionesTable().catch((error) => {
    console.error('❌ Error verificando tabla beca_revisiones:', error.message);
  });

  ensureComunicacionesExtendedColumns().catch((error) => {
    console.error('❌ Error verificando columnas extendidas de comunicaciones:', error.message);
  });

  ensureQuizExtendedColumns().catch((error) => {
    console.error('❌ Error verificando columnas extendidas de quiz_preguntas:', error.message);
  });

  ensureEvaluacionesTable().catch((error) => {
    console.error('❌ Error verificando tabla evaluaciones:', error.message);
  });

  ensureGamificacionPuntosTable().catch((error) => {
    console.error('❌ Error verificando tabla gamificacion_puntos:', error.message);
  });

  ensureQuizRespuestasTable().catch((error) => {
    console.error('❌ Error verificando tabla quiz_respuestas:', error.message);
  });

  ensureAcademiaInteraccionesTable().catch((error) => {
    console.error('❌ Error verificando tabla academia_material_interacciones:', error.message);
  });

  ensureAsistenciaExtendedColumns().catch((error) => {
    console.error('❌ Error verificando columnas extendidas de asistencia:', error.message);
  });

  ensurePartidosLiveCoreColumns().catch((error) => {
    console.error('❌ Error verificando columnas base partidos_live:', error.message);
  });

  ensurePartidosLiveMesaColumns().catch((error) => {
    console.error('❌ Error verificando columnas avanzadas de mesa:', error.message);
  });

  ensureTorneosTable().catch((error) => {
    console.error('❌ Error verificando tabla torneos:', error.message);
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

  ensureAcademiaVideosTable().catch((error) => {
    console.error('❌ Error verificando tabla academia_videos:', error.message);
  });

  ensureAcademiaPizarrasTable().catch((error) => {
    console.error('❌ Error verificando tabla academia_pizarras:', error.message);
  });

  ensureKioscoTables().catch((error) => {
    console.error('❌ Error verificando tablas de kiosco:', error.message);
  });

  ensureCitacionesTables().catch((error) => {
    console.error('❌ Error verificando tablas de citaciones:', error.message);
  });

  ensureNotificacionesAppTable().catch((error) => {
    console.error('❌ Error verificando tabla notificaciones_app:', error.message);
  });

  ensureSuperAdminAccount().catch((error) => {
    console.error('❌ Error asegurando super admin:', error.message);
  });

  scheduleAutomaticBackups();
});

module.exports = app;
