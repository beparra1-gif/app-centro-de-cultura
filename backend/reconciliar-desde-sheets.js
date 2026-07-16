const axios = require('axios');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');
require('dotenv').config();

// Reconciliacion NO destructiva: usa el Google Sheet como fuente de verdad para
// corregir filas existentes (por clave natural) y agregar las que falten.
// Nunca borra filas de la base de datos, aunque no existan en el Sheet.

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizarRut(rut = '') {
  return String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
}

function quoteIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

function createPool(databaseUrl, nodeEnv) {
  const raw = String(databaseUrl || '');
  const safe = raw.includes('sslmode=require') ? raw.replace('sslmode=require', 'sslmode=no-verify') : raw;
  const shouldUseSsl =
    String(nodeEnv || '').toLowerCase() === 'production' ||
    raw.includes('ondigitalocean.com') ||
    raw.includes('sslmode=require') ||
    raw.includes('sslmode=no-verify');
  return new Pool({ connectionString: safe, ssl: shouldUseSsl ? { rejectUnauthorized: false } : false });
}

async function fetchSheetRows(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await axios.get(url);
  const csv = response.data;
  if (!csv || typeof csv !== 'string' || csv.trim().startsWith('<!DOCTYPE html')) {
    throw new Error(`No se pudo leer la hoja ${sheetName}.`);
  }
  return parse(csv, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true });
}

async function getTableColumns(client, tableName) {
  const res = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [tableName]
  );
  return res.rows;
}

function coerceByType(value, dataType) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (raw === '') return null;
  const type = String(dataType || '').toLowerCase();
  if (type === 'boolean') {
    const v = raw.toLowerCase();
    if (['true', '1', 'si', 'sí', 'x', 'yes'].includes(v)) return true;
    if (['false', '0', 'no'].includes(v)) return false;
    return null;
  }
  if (['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'].includes(type)) {
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (type.includes('timestamp')) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  return raw;
}

const HEADER_ALIASES = {
  rut_o_id: 'rut',
  correo_apoderado_cuentas: 'correo',
};

// Campos que NUNCA se sobreescriben en filas ya existentes (seguridad / estado gestionado en la app).
const CAMPOS_PROTEGIDOS = {
  jugadores: ['rut_jugador', 'password_jugador', 'forzar_clave_jugador', 'xp_puntos', 'created_at', 'updated_at'],
  cuentas: ['id', 'password', 'created_at', 'updated_at'],
};

function valoresDifieren(actual, nuevo, dataType) {
  if (actual == null && nuevo == null) return false;
  const type = String(dataType || '').toLowerCase();

  if (type === 'date' || type.includes('timestamp')) {
    const actualFecha = actual == null ? '' : String(actual).slice(0, 10);
    const nuevoFecha = nuevo == null ? '' : String(nuevo).slice(0, 10);
    return actualFecha !== nuevoFecha;
  }

  if (['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'].includes(type)) {
    const actualNum = actual == null ? null : Number(actual);
    const nuevoNum = nuevo == null ? null : Number(nuevo);
    if (Number.isFinite(actualNum) && Number.isFinite(nuevoNum)) return actualNum !== nuevoNum;
  }

  if (type === 'boolean') {
    return Boolean(actual) !== Boolean(nuevo);
  }

  const actualStr = actual == null ? '' : String(actual).trim();
  const nuevoStr = nuevo == null ? '' : String(nuevo).trim();
  return actualStr !== nuevoStr;
}

function mapSheetRow(row, columns, sheetToColumnOverrides = {}) {
  const byNormalizedCol = new Map();
  for (const col of columns) byNormalizedCol.set(normalizeKey(col.column_name), col);

  const mapped = new Map();
  for (const [rawKey, rawValue] of Object.entries(row)) {
    let normalizedHeader = normalizeKey(rawKey);
    if (sheetToColumnOverrides[normalizedHeader]) normalizedHeader = sheetToColumnOverrides[normalizedHeader];
    const aliased = HEADER_ALIASES[normalizedHeader] || normalizedHeader;
    const column = byNormalizedCol.get(aliased);
    if (!column) continue;
    mapped.set(column.column_name, coerceByType(rawValue, column.data_type));
  }
  return mapped;
}

async function reconciliarJugadores(client, sheetId, { apply }) {
  const rows = await fetchSheetRows(sheetId, 'JUGADORES');
  const columns = await getTableColumns(client, 'jugadores');
  const tipoPorColumna = new Map(columns.map((c) => [c.column_name, c.data_type]));
  const dbRes = await client.query('SELECT * FROM jugadores');
  const dbByRut = new Map(dbRes.rows.map((r) => [normalizarRut(r.rut_jugador), r]));

  const protegidos = new Set(CAMPOS_PROTEGIDOS.jugadores);
  const soloEnSheet = [];
  const corregidos = [];
  const sinCambios = [];
  const sheetRuts = new Set();

  for (const row of rows) {
    const mapped = mapSheetRow(row, columns);
    const rutSheet = normalizarRut(mapped.get('rut_jugador') || '');
    if (!rutSheet) continue;
    sheetRuts.add(rutSheet);
    const existente = dbByRut.get(rutSheet);

    if (!existente) {
      soloEnSheet.push({ rut: mapped.get('rut_jugador'), nombre: `${mapped.get('nombres') || ''} ${mapped.get('apellido_paterno') || ''}`.trim() });
      if (apply) {
        const cols = Array.from(mapped.keys());
        const vals = Array.from(mapped.values());
        await client.query(
          `INSERT INTO jugadores (${cols.map(quoteIdent).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (rut_jugador) DO NOTHING`,
          vals
        );
      }
      continue;
    }

    const cambios = [];
    for (const [col, val] of mapped.entries()) {
      if (protegidos.has(col)) continue;
      if (val == null) continue;
      const actual = existente[col];
      if (valoresDifieren(actual, val, tipoPorColumna.get(col))) {
        cambios.push({ campo: col, antes: actual, despues: val });
      }
    }

    if (cambios.length === 0) {
      sinCambios.push(rutSheet);
      continue;
    }

    corregidos.push({ rut: mapped.get('rut_jugador'), nombre: `${existente.nombres || ''} ${existente.apellido_paterno || ''}`.trim(), cambios });
    if (apply) {
      const setCols = cambios.map((c, i) => `${quoteIdent(c.campo)} = $${i + 1}`);
      const vals = cambios.map((c) => c.despues);
      vals.push(rutSheet);
      await client.query(
        `UPDATE jugadores SET ${setCols.join(', ')}, updated_at = NOW() WHERE UPPER(REPLACE(REPLACE(rut_jugador,'.',''),'-','')) = $${vals.length}`,
        vals
      );
    }
  }

  const soloEnBD = dbRes.rows
    .filter((r) => !sheetRuts.has(normalizarRut(r.rut_jugador)))
    .map((r) => ({ rut: r.rut_jugador, nombre: `${r.nombres || ''} ${r.apellido_paterno || ''}`.trim() }));

  return { tabla: 'jugadores', totalSheet: rows.length, totalBD: dbRes.rows.length, soloEnSheet, corregidos, sinCambios: sinCambios.length, soloEnBD };
}

async function reconciliarCuentas(client, sheetId, { apply }) {
  const rows = await fetchSheetRows(sheetId, 'CUENTAS');
  const columns = await getTableColumns(client, 'cuentas');
  const tipoPorColumna = new Map(columns.map((c) => [c.column_name, c.data_type]));
  const dbRes = await client.query('SELECT * FROM cuentas');
  const dbByCorreo = new Map(dbRes.rows.map((r) => [String(r.correo || '').trim().toLowerCase(), r]));
  const dbByRut = new Map(dbRes.rows.filter((r) => r.rut).map((r) => [normalizarRut(r.rut), r]));

  const protegidos = new Set(CAMPOS_PROTEGIDOS.cuentas);
  const soloEnSheet = [];
  const corregidos = [];
  const sinCambios = [];
  const sheetKeys = new Set();

  for (const row of rows) {
    const mapped = mapSheetRow(row, columns, { correo_apoderado: 'correo' });
    const correoSheet = String(mapped.get('correo') || '').trim().toLowerCase();
    const rutSheet = normalizarRut(mapped.get('rut') || '');
    if (!correoSheet && !rutSheet) continue;

    const existente = (correoSheet && dbByCorreo.get(correoSheet)) || (rutSheet && dbByRut.get(rutSheet)) || null;
    if (correoSheet) sheetKeys.add(`correo:${correoSheet}`);
    if (rutSheet) sheetKeys.add(`rut:${rutSheet}`);

    if (!existente) {
      soloEnSheet.push({ rut: mapped.get('rut'), correo: mapped.get('correo'), nombre: `${mapped.get('nombres') || ''} ${mapped.get('apellido_paterno') || ''}`.trim() });
      if (apply) {
        const cols = Array.from(mapped.keys());
        const vals = Array.from(mapped.values());
        await client.query(
          `INSERT INTO cuentas (${cols.map(quoteIdent).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (correo) DO NOTHING`,
          vals
        );
      }
      continue;
    }

    const cambios = [];
    for (const [col, val] of mapped.entries()) {
      if (protegidos.has(col)) continue;
      if (val == null) continue;
      const actual = existente[col];
      if (valoresDifieren(actual, val, tipoPorColumna.get(col))) {
        cambios.push({ campo: col, antes: actual, despues: val });
      }
    }

    if (cambios.length === 0) {
      sinCambios.push(existente.id);
      continue;
    }

    corregidos.push({ id: existente.id, rut: existente.rut, correo: existente.correo, nombre: `${existente.nombres || ''} ${existente.apellido_paterno || ''}`.trim(), cambios });
    if (apply) {
      const setCols = cambios.map((c, i) => `${quoteIdent(c.campo)} = $${i + 1}`);
      const vals = cambios.map((c) => c.despues);
      vals.push(existente.id);
      await client.query(`UPDATE cuentas SET ${setCols.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
    }
  }

  const soloEnBD = dbRes.rows
    .filter((r) => {
      const correoKey = `correo:${String(r.correo || '').trim().toLowerCase()}`;
      const rutKey = r.rut ? `rut:${normalizarRut(r.rut)}` : null;
      return !sheetKeys.has(correoKey) && !(rutKey && sheetKeys.has(rutKey));
    })
    .map((r) => ({ id: r.id, rut: r.rut, correo: r.correo, nombre: `${r.nombres || ''} ${r.apellido_paterno || ''}`.trim(), rol: r.rol }));

  return { tabla: 'cuentas', totalSheet: rows.length, totalBD: dbRes.rows.length, soloEnSheet, corregidos, sinCambios: sinCambios.length, soloEnBD };
}

async function limpiarPagosBasura(client, { apply }) {
  const detectRes = await client.query(`
    SELECT id, rut_pagos, meses_correspondientes, monto_total_pagado, notas_tesoreria, comprobante_url
    FROM pagos_mensualidades
    WHERE (
        COALESCE(monto_total_pagado, 0) <= 0
        AND (meses_correspondientes IS NULL OR meses_correspondientes ILIKE 'sinmes%')
      )
      OR COALESCE(notas_tesoreria, '') ILIKE '%TEST_VALIDACION%'
  `);

  const conComprobante = detectRes.rows.filter((r) => r.comprobante_url && String(r.comprobante_url).trim());
  const idsABorrar = detectRes.rows.filter((r) => !(r.comprobante_url && String(r.comprobante_url).trim())).map((r) => r.id);

  if (apply && idsABorrar.length > 0) {
    await client.query('DELETE FROM pagos_mensualidades WHERE id = ANY($1::int[])', [idsABorrar]);
  }

  return {
    detectadas: detectRes.rows.length,
    borradas: idsABorrar.length,
    protegidasPorComprobante: conComprobante.length,
    protegidasDetalle: conComprobante.map((r) => ({ id: r.id, rut: r.rut_pagos, comprobante_url: r.comprobante_url })),
  };
}

async function reconciliarPagos(client, sheetId, { apply }) {
  const limpieza = await limpiarPagosBasura(client, { apply });

  const rows = await fetchSheetRows(sheetId, 'PAGOS_MENSUALIDADES');
  const columns = await getTableColumns(client, 'pagos_mensualidades');

  let nuevos = 0;
  let actualizados = 0;
  let omitidos = 0;

  for (const row of rows) {
    const mapped = mapSheetRow(row, columns);
    const rutPagos = String(mapped.get('rut_pagos') || '').trim();
    const rutJugador = String(mapped.get('rut_jugador') || '').trim();
    const meses = String(mapped.get('meses_correspondientes') || '').trim();
    const concepto = String(mapped.get('concepto_pago') || 'Mensualidad').trim();
    const monto = Number(mapped.get('monto_total_pagado') || 0);

    if (!rutPagos || !meses || !(Number.isFinite(monto) && monto > 0)) {
      omitidos += 1;
      continue;
    }

    const existingRes = await client.query(
      `SELECT id FROM pagos_mensualidades
       WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_pagos,''),'.',''),'-','')) = UPPER(REPLACE(REPLACE($1,'.',''),'-',''))
         AND UPPER(COALESCE(meses_correspondientes,'')) = UPPER($2)
         AND UPPER(COALESCE(concepto_pago,'Mensualidad')) = UPPER($3)
         AND COALESCE(monto_total_pagado,0) = $4::numeric
         AND UPPER(REPLACE(REPLACE(COALESCE(rut_jugador,''),'.',''),'-','')) = UPPER(REPLACE(REPLACE($5,'.',''),'-',''))
       LIMIT 1`,
      [rutPagos, meses, concepto || 'Mensualidad', monto, rutJugador]
    );

    if (existingRes.rows.length > 0) {
      actualizados += 1;
      if (apply) {
        const cols = Array.from(mapped.keys()).filter((c) => c !== 'id');
        const setCols = cols.map((c, i) => `${quoteIdent(c)} = $${i + 1}`);
        const vals = cols.map((c) => mapped.get(c));
        vals.push(existingRes.rows[0].id);
        await client.query(`UPDATE pagos_mensualidades SET ${setCols.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
      }
      continue;
    }

    nuevos += 1;
    if (apply) {
      const mappedNoId = new Map(mapped);
      if (mappedNoId.has('id') && mappedNoId.get('id') == null) mappedNoId.delete('id');
      const cols = Array.from(mappedNoId.keys());
      const vals = Array.from(mappedNoId.values());
      await client.query(
        `INSERT INTO pagos_mensualidades (${cols.map(quoteIdent).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})`,
        vals
      );
    }
  }

  const totalBDRes = await client.query('SELECT COUNT(*)::int AS n FROM pagos_mensualidades');
  return { tabla: 'pagos_mensualidades', totalSheet: rows.length, totalBD: totalBDRes.rows[0].n, nuevos, actualizados, omitidos, limpieza };
}

async function runReconciliacion({ databaseUrl, nodeEnv, googleSheetId, apply = false, logger = console } = {}) {
  const pool = createPool(databaseUrl || process.env.DATABASE_URL, nodeEnv || process.env.NODE_ENV);
  const sheetId = googleSheetId || process.env.GOOGLE_SHEET_ID;
  const client = await pool.connect();
  try {
    logger.log(`Modo: ${apply ? 'APLICAR CAMBIOS' : 'DRY-RUN (solo reporte, sin escribir)'}`);
    const jugadores = await reconciliarJugadores(client, sheetId, { apply });
    const cuentas = await reconciliarCuentas(client, sheetId, { apply });
    const pagos = await reconciliarPagos(client, sheetId, { apply });
    return { jugadores, cuentas, pagos };
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { runReconciliacion };

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  runReconciliacion({ apply })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error('Error:', err.message);
      process.exitCode = 1;
    });
}
