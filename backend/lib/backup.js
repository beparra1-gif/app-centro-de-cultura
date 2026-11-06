// Backups de base de datos (pg_dump / JSON), subida a Spaces, retención, cron automático y estado.
// Extraído de server.js sin cambios de comportamiento.
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { ListObjectsV2Command, DeleteObjectsCommand, S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const zlib = require('zlib');
const cron = require('node-cron');
const { clasificarBackupsPorRetencion } = require('./retencionBackups');
const { normalizeEnvValue, resolveRuntimePath, serializeError } = require('./util');
const { pool } = require('./db');

let isBackupRunning = false;
let lastBackupRunStatus = null;
let backupCronTask = null;
const execFileAsync = promisify(execFile);
const obtenerEstadoEjecucionBackup = () => ({ running: isBackupRunning, lastRun: lastBackupRunStatus });

const getBackupConfig = () => {
  const backupDir = resolveRuntimePath(String(process.env.BACKUP_DIR || 'backups'));
  const manifestPath = resolveRuntimePath(String(process.env.BACKUP_MANIFEST_PATH || path.join(backupDir, 'backup-manifest.json')));
  // Costos (2026-11): antes cada 6 h + uno en CADA arranque (cada deploy
  // reinicia el servidor) → cientos de copias en Spaces. Ahora uno diario
  // (04:00 UTC ≈ 01:00 en Chile) y sin backup al arrancar, salvo que se
  // configure BACKUP_CRON / BACKUP_RUN_ON_START.
  const cronExpr = String(process.env.BACKUP_CRON || '0 4 * * *').trim();
  const keepDays = Number(process.env.BACKUP_KEEP_DAYS || 7);
  const keepMaxFiles = Number(process.env.BACKUP_KEEP_MAX_FILES || 48);
  const runOnStart = String(process.env.BACKUP_RUN_ON_START || 'false').toLowerCase() === 'true';
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

// Retención de backups en Spaces. Antes nunca se borraba nada del bucket
// (la limpieza solo actuaba dentro del contenedor, que igual se descarta en
// cada deploy). Política: todos los de los últimos BACKUP_S3_KEEP_DAILY días,
// el más reciente de cada semana por BACKUP_S3_KEEP_WEEKLY semanas y el más
// reciente de cada mes por BACKUP_S3_KEEP_MONTHLY meses. Borrar es
// irreversible: solo se aplica con BACKUP_S3_RETENCION_APLICAR=true; si no,
// se calcula y se informa (simulación) en el manifiesto y en los logs.
const configRetencionSpaces = () => {
  const num = (valor, porDefecto) => {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : porDefecto;
  };
  return {
    aplicar: String(process.env.BACKUP_S3_RETENCION_APLICAR || 'false').toLowerCase() === 'true',
    diarios: num(process.env.BACKUP_S3_KEEP_DAILY, 7),
    semanales: num(process.env.BACKUP_S3_KEEP_WEEKLY, 8),
    mensuales: num(process.env.BACKUP_S3_KEEP_MONTHLY, 12),
  };
};

const aplicarRetencionSpaces = async ({ s3, storage }) => {
  const cfg = configRetencionSpaces();
  const objetos = [];
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: storage.bucket, Prefix: `${storage.prefix}/`, ContinuationToken: token }));
    (r.Contents || []).forEach((o) => objetos.push({ Key: o.Key, LastModified: o.LastModified, Size: o.Size || 0 }));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);

  const { conservar, borrar } = clasificarBackupsPorRetencion(objetos, cfg);
  const bytes = (lista) => lista.reduce((suma, o) => suma + (o.Size || 0), 0);
  const resumen = {
    modo: cfg.aplicar ? 'aplicada' : 'simulacion',
    politica: { diarios: cfg.diarios, semanales: cfg.semanales, mensuales: cfg.mensuales },
    totalObjetos: objetos.length,
    totalMB: Math.round(bytes(objetos) / 1048576),
    conservar: conservar.length,
    conservarMB: Math.round(bytes(conservar) / 1048576),
    borrar: borrar.length,
    borrarMB: Math.round(bytes(borrar) / 1048576),
    borrados: 0,
  };
  if (cfg.aplicar && borrar.length > 0) {
    for (let i = 0; i < borrar.length; i += 1000) {
      const lote = borrar.slice(i, i + 1000);
      await s3.send(new DeleteObjectsCommand({
        Bucket: storage.bucket,
        Delete: { Objects: lote.map((o) => ({ Key: o.Key })), Quiet: true },
      }));
      resumen.borrados += lote.length;
    }
  }
  console.log(`[BACKUP] Retención Spaces (${resumen.modo}): ${resumen.totalObjetos} objetos / ${resumen.totalMB} MB → conservar ${resumen.conservar} (${resumen.conservarMB} MB), ${cfg.aplicar ? 'borrados' : 'se borrarían'} ${resumen.borrar} (${resumen.borrarMB} MB).`);
  return resumen;
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
    // Desde ~3.7xx, el SDK v3 por defecto manda/exige checksums flexibles
    // (x-amz-checksum-*) en cada request. DigitalOcean Spaces (como la
    // mayoría de proveedores S3-compatibles) no los soporta bien, y la
    // respuesta de error que devuelve no calza con lo que el SDK espera
    // parsear — el resultado es un "UnknownError" genérico sin ningún
    // detalle real. Forzar 'WHEN_REQUIRED' vuelve al comportamiento
    // clásico (solo cuando el propio SDK lo requiere, no por defecto).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  const fileName = path.basename(localFilePath);
  const objectKey = `${storage.prefix}/${new Date().toISOString().slice(0, 10)}/${fileName}`;
  const fileBuffer = fs.readFileSync(localFilePath);
  const contentType = fileName.endsWith('.gz') ? 'application/gzip' : (strategy === 'json_fallback' ? 'application/json' : 'application/sql');

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

  let retencion;
  try {
    retencion = await aplicarRetencionSpaces({ s3, storage });
  } catch (error) {
    console.error('[BACKUP] Retención Spaces falló (el backup sí se subió):', error.message);
    retencion = { error: error.message };
  }

  return {
    attempted: true,
    uploaded: true,
    bucket: storage.bucket,
    endpoint: storage.endpoint,
    region: storage.region,
    objectKey,
    retencion,
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

  // Columnas bytea (logos, fotos, videos, pizarras) llegan como Buffer y
  // JSON.stringify las escribía como {"type":"Buffer","data":[1,2,…]}: ~3,5×
  // el tamaño real. Se guardan en base64 y el archivo completo va en gzip.
  const json = JSON.stringify(backupPayload, (_clave, valor) => (
    valor && valor.type === 'Buffer' && Array.isArray(valor.data)
      ? { $base64: Buffer.from(valor.data).toString('base64') }
      : valor
  ));
  fs.writeFileSync(outputFile, zlib.gzipSync(Buffer.from(`${json}\n`, 'utf8'), { level: 9 }));
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
    const jsonFileName = `ccf_backup_${stamp}.json.gz`;
    const sqlOutput = path.join(cfg.backupDir, sqlFileName);
    const jsonOutput = path.join(cfg.backupDir, jsonFileName);

    let strategy = 'pg_dump';
    let outputPath = sqlOutput;

    try {
      await runPgDumpBackup({ databaseUrl, outputFile: sqlOutput });
      // Comprimir el .sql (texto: suele quedar en ~10-15%).
      const sqlComprimido = `${sqlOutput}.gz`;
      fs.writeFileSync(sqlComprimido, zlib.gzipSync(fs.readFileSync(sqlOutput), { level: 9 }));
      fs.unlinkSync(sqlOutput);
      outputPath = sqlComprimido;
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
      // El SDK de S3 a veces solo da ".message" genérico (ej. "UnknownError")
      // sin decir por qué — se registra también en logs del servidor el resto
      // del objeto de error (nombre, código HTTP, request id) para poder
      // diagnosticar sin adivinar.
      console.error('[backup upload]', {
        message: uploadError.message,
        name: uploadError.name,
        code: uploadError.Code || uploadError.code,
        httpStatusCode: uploadError.$metadata?.httpStatusCode,
        requestId: uploadError.$metadata?.requestId,
        stack: uploadError.stack,
      });
      upload = {
        attempted: true,
        uploaded: false,
        skipped: true,
        reason: `${uploadError.message} | name=${uploadError.name || '?'} code=${uploadError.Code || uploadError.code || '?'} http=${uploadError.$metadata?.httpStatusCode || '?'}`,
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

module.exports = {
  getBackupStatus,
  obtenerEstadoEjecucionBackup,
  runDatabaseBackup,
  scheduleAutomaticBackups,
};
