// Rutas de administración: health, sincronización con Google Sheets, backups, calidad de datos, conflictos de RUT y auditoría.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const cron = require('node-cron');
const { fetchSheetRows, runImportFromSheets } = require('../import-google-sheets');
const { authenticate, requireModule } = require('../security/auth');
const { pool, sheetsSyncManager, sheetsWebhookSyncManager } = require('../lib/db');
const { formatearRut } = require('../lib/rut');
const { detectarCamposFaltantesCuenta } = require('../lib/cuentas');
const { getBackupStatus, obtenerEstadoEjecucionBackup, runDatabaseBackup } = require('../lib/backup');

const router = express.Router();

let isSheetsSyncRunning = false;
let lastSheetsSyncStatus = null;

const getSyncTokenFromRequest = (req) => {
  const headerToken = req.headers['x-sync-token'];
  if (headerToken) return String(headerToken).trim();

  const authHeader = String(req.headers.authorization || '');
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
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

  // Misma lectura que la importación: cuenta de servicio si está configurada
  // (Sheet privado), CSV público solo como respaldo.
  const rows = await fetchSheetRows(sheetId, 'JUGADORES');

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

// ========== HEALTH CHECK ==========
router.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

router.get('/api/admin/sync-sheets/status', (req, res) => {
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

router.get('/api/admin/ops-status', async (req, res) => {
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

router.get('/api/admin/backup-status', (req, res) => {
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
    running: obtenerEstadoEjecucionBackup().running,
    lastRun: obtenerEstadoEjecucionBackup().lastRun,
    backup: getBackupStatus(),
    checkedAt: new Date().toISOString(),
  });
});

router.post('/api/admin/backup-run', async (req, res) => {
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

router.get('/api/admin/data-quality', async (req, res) => {
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

router.get('/api/admin/data-quality/details', async (req, res) => {
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

router.get('/api/admin/jugadores-rut-conflicts', async (req, res) => {
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

router.post('/api/admin/jugadores-rut-conflicts/resolve', async (req, res) => {
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

router.post('/api/admin/sync-sheets', async (req, res) => {
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

router.post('/api/admin/sync-sheets/export', async (req, res) => {
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
router.post('/api/admin/backfill-rut-apoderado', async (req, res) => {
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

router.post('/api/admin/sync-sheets/webhook-ping', async (req, res) => {
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

router.post('/api/admin/sync-sheets/webhook-flush', async (req, res) => {
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
// 8. TASKS AUTOMÁTICAS (Cron)
// ==========================================

// Trae automáticamente lo que se cargue directo en el Google Sheet (ej. altas
// masivas de CUENTAS o JUGADORES) hacia Postgres, sin depender de que alguien
// entre a Panel > Auditoría a apretar "Sincronizar ahora". Mismo motor
// incremental (solo agrega filas nuevas, no pisa lo que ya existe en la app)
// y mismo lock isSheetsSyncRunning que usa ese botón manual, para que nunca
// corran los dos a la vez. La dirección app -> Sheet ya es automática aparte
// (ver el middleware de auto-export más arriba, sheetsSyncManager.enqueueTable).
cron.schedule('*/10 * * * *', async () => {
  if (!process.env.GOOGLE_SHEET_ID) return;
  if (isSheetsSyncRunning) return;

  isSheetsSyncRunning = true;
  lastSheetsSyncStatus = {
    status: 'running',
    startedAt: new Date().toISOString(),
    syncedAt: lastSheetsSyncStatus?.syncedAt || null,
    totals: lastSheetsSyncStatus?.totals || null,
    mode: 'incremental-cron',
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
      mode: 'incremental-cron',
      startedAt: lastSheetsSyncStatus?.startedAt || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };

    if (totals.importadas > 0) {
      console.log(`[CRON] Sincronización Google Sheets: ${totals.importadas} fila(s) nueva(s) importada(s).`);
    }
  } catch (err) {
    lastSheetsSyncStatus = {
      status: 'error',
      startedAt: lastSheetsSyncStatus?.startedAt || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      error: err.message,
    };
    console.error('[CRON] Error sincronizando desde Google Sheets:', err.message);
  } finally {
    isSheetsSyncRunning = false;
  }
});

// ==========================================
// 24. ENDPOINTS: AUDITORIA (FASE 3)
// ==========================================

router.get('/api/auditoria', authenticate, requireModule('auditoria'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM auditoria ORDER BY fecha_accion DESC LIMIT 100`);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/auditoria]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
