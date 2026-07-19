const axios = require('axios');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');
require('dotenv').config();

const DEFAULT_ENV = {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
};

const SHEET_TABLE_MAP = [
  { sheet: 'JUGADORES', table: 'jugadores' },
  { sheet: 'CUENTAS', table: 'cuentas' },
  { sheet: 'PAGOS_MENSUALIDADES', table: 'pagos_mensualidades' },
  { sheet: 'COMUNICACIONES', table: 'comunicaciones' },
  { sheet: 'CONVOCATORIAS', table: 'convocatorias' },
  { sheet: 'EVENTOS', table: 'eventos' },
  { sheet: 'ASISTENCIA', table: 'asistencia' },
  { sheet: 'PARTIDOS_LIVE', table: 'partidos_live' },
  { sheet: 'ALERTAS', table: 'alertas' },
  { sheet: 'ESTADISTICAS_STATS', table: 'estadisticas' },
  { sheet: 'EVALUACIONES', table: 'evaluaciones' },
  { sheet: 'GAMIFICACION_PUNTOS', table: 'gamificacion_puntos' },
  { sheet: 'MARCAS_TIEMPO', table: 'marcas_tiempo' },
  { sheet: 'RESULTADOS', table: 'resultados' },
  { sheet: 'QUIZ_PREGUNTAS', table: 'quiz_preguntas' },
  { sheet: 'PIZARRA_TACTICA', table: 'pizarra_tactica' },
  { sheet: 'JUGADORES_VISITA', table: 'jugadores_visita' },
  { sheet: 'AUDITORIA', table: 'auditoria' },
  { sheet: 'STAFF', table: 'staff' },
  { sheet: 'TORNEOS', table: 'torneos' },
  { sheet: 'CAJA_EVENTO_KIOSCO', table: 'caja_evento_kiosco' },
  { sheet: 'CATALOGO_INVENTARIO', table: 'catalogo_inventario' },
  { sheet: 'EGRESOS', table: 'egresos' },
  { sheet: 'CLUBES', table: 'clubes' },
  { sheet: 'ASISTENCIA_EVENTOS', table: 'asistencia_eventos' },
];

const HEADER_ALIASES = {
  id_post: 'id',
  id_pago: 'id',
  id_alerta: 'id',
  id_registro: 'id',
  id_resultado: 'id',
  id_pregunta: 'id',
  id_marca: 'id',
  id_evaluaciones: 'id',
  id_log: 'id',
  rut_o_id: 'rut',
  correo_apoderado: 'correo',
  valor_mensualidad: 'valor_mensualidad',
  coomentarios: 'comentarios',
  periodo_actual: 'periodo_actual',
  apellidos_materno: 'apellido_materno',
  reserva_bus_acomapañante: 'reserva_bus_acompanante',
  rut_pago: 'rut_pagos',
};

function createSheetsPool(databaseUrl, nodeEnv) {
  const rawDatabaseUrl = String(databaseUrl || '');
  const safeDatabaseUrl = rawDatabaseUrl.includes('sslmode=require')
    ? rawDatabaseUrl.replace('sslmode=require', 'sslmode=no-verify')
    : rawDatabaseUrl;

  const shouldUseSsl =
    String(nodeEnv || '').toLowerCase() === 'production' ||
    rawDatabaseUrl.includes('ondigitalocean.com') ||
    rawDatabaseUrl.includes('sslmode=require') ||
    rawDatabaseUrl.includes('sslmode=no-verify');

  return new Pool({
    connectionString: safeDatabaseUrl,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
  });
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function quoteIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}


function extractSheetId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

function parseBool(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'x', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return null;
}

function parseDateLike(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yy = dmy[3];
    return `${yy}-${mm}-${dd}`;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return null;
}

function coerceByType(value, dataType) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (raw === '') return null;

  const type = String(dataType || '').toLowerCase();

  if (type === 'boolean') {
    return parseBool(raw);
  }

  if (
    type === 'integer' ||
    type === 'bigint' ||
    type === 'smallint' ||
    type === 'numeric' ||
    type === 'real' ||
    type === 'double precision'
  ) {
    // Tolera "50%" además de "50" (ej. columna beca) — ninguna columna
    // numérica del sistema usa % legítimamente, así que quitarlo es seguro.
    const parsed = Number(raw.replace(',', '.').replace(/%\s*$/, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (type === 'date') {
    return parseDateLike(raw);
  }

  if (type.includes('timestamp')) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  if (type === 'json' || type === 'jsonb') {
    try {
      const json = JSON.parse(raw);
      return JSON.stringify(json);
    } catch {
      return null;
    }
  }

  return raw;
}

async function fetchPublicSheetRows(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await axios.get(url);
  const csv = response.data;

  if (!csv || typeof csv !== 'string' || csv.trim().startsWith('<!DOCTYPE html')) {
    throw new Error(`No se pudo leer la hoja ${sheetName}. Verifica nombre de pestaña y acceso público.`);
  }

  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true,
  });
}

async function getTableMeta(client, tableName) {
  const colsRes = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default, is_identity
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  const pkRes = await client.query(
    `SELECT a.attname AS column_name
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary`,
    [tableName]
  );

  const uniqueRes = await client.query(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.table_name = $1
       AND tc.constraint_type = 'UNIQUE'`,
    [tableName]
  );

  const columns = colsRes.rows;
  const requiredColumns = columns
    .filter(
      (c) =>
        c.is_nullable === 'NO' &&
        c.column_default == null &&
        c.is_identity !== 'YES'
    )
    .map((c) => c.column_name);
  const pkColumns = pkRes.rows.map((r) => r.column_name);
  const uniqueColumns = [...new Set(uniqueRes.rows.map((r) => r.column_name))];
  return { columns, pkColumns, uniqueColumns, requiredColumns };
}

function mapRowToTableColumns(row, columns) {
  const byNormalizedCol = new Map();
  for (const col of columns) {
    byNormalizedCol.set(normalizeKey(col.column_name), col);
  }

  const mapped = [];
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const normalizedHeader = normalizeKey(rawKey);
    const aliased = HEADER_ALIASES[normalizedHeader] || normalizedHeader;
    const column = byNormalizedCol.get(aliased);
    if (!column) continue;

    const value = coerceByType(rawValue, column.data_type);
    mapped.push({ column: column.column_name, value });
  }

  const dedup = new Map();
  for (const item of mapped) {
    dedup.set(item.column, item.value);
  }

  return Array.from(dedup.entries()).map(([column, value]) => ({ column, value }));
}

async function upsertRow(client, tableName, mappedPairs, pkColumns, uniqueColumns, requiredColumns, options = {}) {
  const incrementalOnly = options.incrementalOnly !== false;
  if (mappedPairs.length === 0) return { skipped: true, reason: 'sin columnas mapeables' };

  const valuesByCol = new Map(mappedPairs.map((p) => [p.column, p.value]));

  // Let SERIAL/BIGSERIAL defaults assign IDs when sheet row doesn't provide one.
  if (valuesByCol.has('id') && valuesByCol.get('id') == null) {
    valuesByCol.delete('id');
  }

  if (tableName === 'cuentas') {
    const rawCorreo = valuesByCol.get('correo');
    const rawRut = valuesByCol.get('rut');
    const fallbackId = Date.now() + Math.floor(Math.random() * 100000);

    if (!rawCorreo) {
      const rutBase = String(rawRut || '').replace(/[^0-9kK]/g, '').toLowerCase() || `sinrut${fallbackId}`;
      valuesByCol.set('correo', `pendiente-${rutBase}@actualizar.local`);
    }

    if (!rawRut) {
      valuesByCol.set('rut', `PENDIENTE-RUT-${fallbackId}`);
    }
  }
  const missingRequired = requiredColumns.filter(
    (col) => !valuesByCol.has(col) || valuesByCol.get(col) == null
  );
  if (missingRequired.length > 0) {
    return { skipped: true, reason: `faltan columnas requeridas: ${missingRequired.join(', ')}` };
  }

  const hasAllPk = pkColumns.length > 0 && pkColumns.every((pk) => valuesByCol.has(pk) && valuesByCol.get(pk) != null);
  const uniqueCandidates = uniqueColumns.filter((u) => valuesByCol.has(u) && valuesByCol.get(u) != null);

  const cols = Array.from(valuesByCol.keys());
  const vals = Array.from(valuesByCol.values());
  const placeholders = vals.map((_, i) => `$${i + 1}`);

  let sql = `INSERT INTO ${quoteIdent(tableName)} (${cols.map(quoteIdent).join(', ')}) VALUES (${placeholders.join(', ')})`;

  if (hasAllPk) {
    sql += ` ON CONFLICT (${pkColumns.map(quoteIdent).join(', ')}) DO NOTHING`;
  } else if (uniqueCandidates.length > 0) {
    const conflictCol = uniqueCandidates[0];
    sql += ` ON CONFLICT (${quoteIdent(conflictCol)}) DO NOTHING`;
  } else if (tableName === 'pagos_mensualidades') {
    const rutPagos = String(valuesByCol.get('rut_pagos') || '').trim();
    const rutJugador = String(valuesByCol.get('rut_jugador') || '').trim();
    const meses = String(valuesByCol.get('meses_correspondientes') || '').trim();
    const concepto = String(valuesByCol.get('concepto_pago') || 'Mensualidad').trim();
    const monto = Number(valuesByCol.get('monto_total_pagado') || 0);

    if (!rutPagos || !meses || !(Number.isFinite(monto) && monto > 0)) {
      if (incrementalOnly) {
        return { skipped: true, reason: 'pagos_mensualidades sin llave rut_pagos/meses/monto valida para incremental' };
      }
      await client.query(sql, vals);
      return { skipped: false };
    }

    const existingRes = await client.query(
      `SELECT id
       FROM pagos_mensualidades
       WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_pagos, ''), '.', ''), '-', '')) = UPPER(REPLACE(REPLACE($1, '.', ''), '-', ''))
         AND UPPER(COALESCE(meses_correspondientes, '')) = UPPER($2)
         AND UPPER(COALESCE(concepto_pago, 'Mensualidad')) = UPPER($3)
         AND COALESCE(monto_total_pagado, 0) = $4::numeric
         AND UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = UPPER(REPLACE(REPLACE($5, '.', ''), '-', ''))
       LIMIT 1`,
      [rutPagos, meses, concepto || 'Mensualidad', monto, rutJugador]
    );

    if (existingRes.rows.length > 0) {
      const updateColumns = [];
      const updateValues = [];
      let index = 1;

      for (const [column, value] of valuesByCol.entries()) {
        // updated_at se fija siempre a NOW() más abajo — si el Sheet también
        // trae una columna que mapea a updated_at, incluirla acá duplicaba
        // la asignación en el mismo UPDATE ("multiple assignments to same
        // column"), lo que hacía fallar la fila entera.
        if (column === 'id' || column === 'updated_at') continue;
        updateColumns.push(`${quoteIdent(column)} = $${index}`);
        updateValues.push(value);
        index += 1;
      }

      updateColumns.push(`updated_at = NOW()`);
      updateValues.push(existingRes.rows[0].id);

      await client.query(
        `UPDATE pagos_mensualidades
         SET ${updateColumns.join(', ')}
         WHERE id = $${index}`,
        updateValues
      );

      return { skipped: false };
    }

    await client.query(sql, vals);
    return { skipped: false };
  } else if (incrementalOnly) {
    return { skipped: true, reason: 'sin clave primaria o unica para modo incremental' };
  }

  await client.query(sql, vals);
  return { skipped: false };
}

async function importSheetToTable(client, sheetId, mapping, options = {}) {
  const { sheet, table } = mapping;
  const rows = await fetchPublicSheetRows(sheetId, sheet);
  const { columns, pkColumns, uniqueColumns, requiredColumns } = await getTableMeta(client, table);

  if (columns.length === 0) {
    return { sheet, table, total: rows.length, imported: 0, skipped: rows.length, errors: 0, note: 'tabla no existe' };
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const mapped = mapRowToTableColumns(row, columns);
    try {
      const result = await upsertRow(client, table, mapped, pkColumns, uniqueColumns, requiredColumns, options);
      if (result.skipped) skipped += 1;
      else imported += 1;
    } catch (err) {
      // 23505 = unique_violation. Tablas con más de una columna UNIQUE (ej.
      // cuentas: rut Y correo) solo pueden declarar UNA como target de ON
      // CONFLICT — un choque contra la otra columna única no queda cubierto
      // por ese DO NOTHING y explotaba como error duro en vez de omitirse
      // como una fila duplicada más (mismo resultado práctico que el ON
      // CONFLICT ya buscaba: no insertar un duplicado, no romper el import).
      if (err.code === '23505') {
        skipped += 1;
      } else {
        errors += 1;
        if (errors <= 3) {
          console.error(`[${sheet}] Error fila:`, err.message);
        }
      }
    }
  }

  return { sheet, table, total: rows.length, imported, skipped, errors };
}

async function buildDataQualitySummary(client) {
  const jugadoresMissingRes = await client.query(
    `SELECT COUNT(*)::INT AS total
     FROM jugadores
     WHERE COALESCE(TRIM(nombres), '') = ''
        OR COALESCE(TRIM(rut_jugador), '') = ''
        OR COALESCE(TRIM(rama), '') = ''
        OR COALESCE(TRIM(categoria), '') = ''`
  );

  const jugadoresRutFormatoRes = await client.query(
    `SELECT COUNT(*)::INT AS total
     FROM jugadores
     WHERE COALESCE(rut_jugador, '') <> ''
       AND NOT (UPPER(REPLACE(REPLACE(rut_jugador, '.', ''), '-', '')) ~ '^[0-9]{7,8}[0-9K]$')`
  );

  const pagosSinRutRes = await client.query(
    `SELECT COUNT(*)::INT AS total
     FROM pagos_mensualidades
     WHERE COALESCE(TRIM(rut_jugador), '') = ''
       AND COALESCE(TRIM(rut_pagos), '') = ''`
  );

  const pagosSinMesesRes = await client.query(
    `SELECT COUNT(*)::INT AS total
     FROM pagos_mensualidades
     WHERE COALESCE(TRIM(meses_correspondientes), '') = ''`
  );

  return {
    jugadores: {
      faltantesClave: jugadoresMissingRes.rows[0]?.total || 0,
      rutFormatoInvalido: jugadoresRutFormatoRes.rows[0]?.total || 0,
    },
    pagosMensualidades: {
      sinRutJugador: pagosSinRutRes.rows[0]?.total || 0,
      sinMeses: pagosSinMesesRes.rows[0]?.total || 0,
    },
  };
}

async function runImportFromSheets(options = {}) {
  const logger = options.logger || console;
  const databaseUrl = options.databaseUrl || DEFAULT_ENV.DATABASE_URL;
  const nodeEnv = options.nodeEnv || DEFAULT_ENV.NODE_ENV;
  const googleSheetId = options.googleSheetId || DEFAULT_ENV.GOOGLE_SHEET_ID;

  if (!databaseUrl) {
    throw new Error('Falta DATABASE_URL en backend/.env');
  }

  if (!googleSheetId) {
    throw new Error('Falta GOOGLE_SHEET_ID en backend/.env (puede ser ID o URL completa del Sheet)');
  }

  const pool = createSheetsPool(databaseUrl, nodeEnv);
  const sheetId = extractSheetId(googleSheetId);
  const incrementalOnly = options.incrementalOnly !== false;
  const client = await pool.connect();
  const summary = [];
  let qualitySummary;

  try {
    logger.log('Iniciando importacion completa desde Google Sheets a PostgreSQL...');
    logger.log(`Spreadsheet ID: ${sheetId}`);

    for (const mapping of SHEET_TABLE_MAP) {
      logger.log(`\nImportando hoja ${mapping.sheet} -> tabla ${mapping.table} ...`);
      const result = await importSheetToTable(client, sheetId, mapping, { incrementalOnly });
      summary.push(result);
      logger.log(
        `OK ${mapping.sheet}: total=${result.total}, importadas=${result.imported}, omitidas=${result.skipped}, errores=${result.errors}`
      );
    }

    logger.log('\n===== RESUMEN FINAL =====');
    for (const item of summary) {
      logger.log(
        `${item.sheet} -> ${item.table}: total=${item.total}, importadas=${item.imported}, omitidas=${item.skipped}, errores=${item.errors}`
      );
    }

    qualitySummary = await buildDataQualitySummary(client);
    logger.log(
      `Calidad jugadores: faltantes=${qualitySummary.jugadores.faltantesClave}, rutFormatoInvalido=${qualitySummary.jugadores.rutFormatoInvalido}`
    );
    logger.log(
      `Calidad pagos_mensualidades: sinRut=${qualitySummary.pagosMensualidades.sinRutJugador}, sinMeses=${qualitySummary.pagosMensualidades.sinMeses}`
    );

    return {
      sheetId,
      summary,
      qualitySummary,
    };
  } catch (err) {
    logger.error('Fallo general de importacion:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runImportFromSheets()
    .then(() => {
      process.exitCode = 0;
    })
    .catch(() => {
      process.exitCode = 1;
    });
}

module.exports = {
  runImportFromSheets,
  SHEET_TABLE_MAP,
  HEADER_ALIASES,
};
