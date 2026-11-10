// Importación de pagos desde la planilla de Tesorería: lectura, plan, aplicación y carga automática (cron).
// Extraído de server.js sin cambios de comportamiento.
const cron = require('node-cron');
const { parsearGidsPlanilla, planificarImportacion } = require('./importarPagosPlanilla');
const { pool, sheetsSyncManager } = require('./db');
const { asegurarTablaConfiguracion, leerConfigTarifas } = require('./configuracion');
const { estadoSincronizacionSheets } = require('./sincronizacionSheets');

// ==========================================
// IMPORTAR PAGOS 2026 DESDE LA PLANILLA DE TESORERÍA (solo super admin)
// ==========================================
// GET revisa (no cambia nada) y POST aplica el MISMO plan recalculado en el
// servidor (ver backend/lib/importarPagosPlanilla.js). Con la carga
// automática activada, un cron aplica cada 30 min lo que falte (crear
// deportistas y agregar pagos; los duplicados se borran solo a mano). La
// planilla debe estar compartida "cualquiera con el enlace" (lectura).
const leerPlanillaPagos = async (urlPlanilla) => {
  const id = (String(urlPlanilla || '').match(/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/) || [])[1];
  if (!id) throw Object.assign(new Error('Pega el enlace completo de la planilla de Google.'), { status: 400 });
  const errorLectura = (hoja) => Object.assign(
    new Error(`No se pudo leer la hoja "${hoja}". Revisa que la planilla esté compartida con "Cualquier persona con el enlace".`),
    { status: 400 }
  );
  const esHtml = (texto) => /^\s*<!DOCTYPE|<html/i.test(texto);
  // gid de cada pestaña: la exportación por gid trae TODAS las filas (gviz
  // puede truncar). Si no se logra, se usa gviz por nombre como respaldo.
  let gids = {};
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/edit`, { signal: AbortSignal.timeout(20000) });
    if (r.ok) gids = parsearGidsPlanilla(await r.text());
  } catch { /* respaldo gviz */ }
  const leerHoja = async (hoja, { opcional = false } = {}) => {
    const gid = gids[hoja.toLowerCase()];
    const url = gid
      ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
      : `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(hoja)}`;
    // Un reintento: Google a veces corta una de las lecturas simultáneas.
    const intentar = async () => {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const texto = await r.text();
      if (!r.ok || esHtml(texto)) throw errorLectura(hoja);
      return texto;
    };
    try {
      try {
        return await intentar();
      } catch {
        await new Promise((resolver) => { setTimeout(resolver, 1500); });
        return await intentar();
      }
    } catch (error) {
      if (opcional) {
        console.warn(`[IMPORTAR-PLANILLA] No se pudo leer la hoja opcional "${hoja}" (${gid ? `gid ${gid}` : 'sin gid'}): ${error.message}`);
        return '';
      }
      throw error.status ? error : errorLectura(hoja);
    }
  };
  const [csvDeportistas, csvSocios, csvBase] = await Promise.all([
    leerHoja('Pagos deportistas'), leerHoja('Pagos Socio'), leerHoja('Base Principal', { opcional: true }),
  ]);
  return { csvDeportistas, csvSocios, csvBase };
};

const construirPlanImportacionPagos = async (urlPlanilla) => {
  const { csvDeportistas, csvSocios, csvBase } = await leerPlanillaPagos(urlPlanilla);
  const [jugadores, cuentas, pagos, utm] = await Promise.all([
    pool.query('SELECT rut_jugador, nombres, apellido_paterno, rut_apoderado, correo_apoderado, valor_mensualidad, beca, exento_mensualidad, apoderado_socio FROM jugadores'),
    pool.query('SELECT rut, nombres, apellido_paterno, correo, es_socio, monto_mensual_base, utm_valor_referencia, monto_mensual_override FROM cuentas'),
    pool.query('SELECT id, rut_jugador, rut_pagos, concepto_pago, meses_correspondientes, monto_total_pagado, estado_pago, comprobante_url, notas_tesoreria FROM pagos_mensualidades'),
    pool.query('SELECT mes, valor FROM utm_mensual WHERE anio = 2026'),
  ]);
  const historialTarifas = (await leerConfigTarifas().catch(() => null))?.historial || null;
  try {
    return planificarImportacion({
      csvDeportistas, csvSocios, csvBase, historialTarifas,
      jugadores: jugadores.rows, cuentas: cuentas.rows, pagos: pagos.rows,
      utmPorMes: Object.fromEntries(utm.rows.map((r) => [Number(r.mes), Number(r.valor)])),
    });
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }
};

// Aplica un plan en UNA transacción: fichas nuevas → pagos → (opcional)
// borrar duplicados. Quien llama debe tener tomado isSheetsSyncRunning.
const aplicarPlanImportacionPagos = async (plan, { borrarDuplicados, actualizarFichas = false }) => {
  const client = await pool.connect();
  let creados = 0;
  let actualizadas = 0;
  let borrados = 0;
  try {
    await client.query('BEGIN');
    for (const { ficha } of plan.crearDeportistas || []) {
      const r = await client.query(
        `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, rama, categoria,
                                correo_apoderado, fecha_ingreso, estado, apoderado_socio)
         SELECT $1::varchar, $2, $3, $4, $5::date, $6, $7, $8, $9::date, 'ACTIVO', $10
         WHERE NOT EXISTS (SELECT 1 FROM jugadores WHERE REPLACE(REPLACE(UPPER(rut_jugador), '.', ''), '-', '') = REPLACE(UPPER($1::varchar), '-', ''))`,
        [ficha.rut_jugador, ficha.nombres, ficha.apellido_paterno, ficha.apellido_materno, ficha.fecha_nacimiento,
          ficha.rama, ficha.categoria, ficha.correo_apoderado, ficha.fecha_ingreso, Boolean(ficha.apoderado_socio)]
      );
      creados += r.rowCount;
    }
    if (actualizarFichas) {
      for (const { rut, cambios } of plan.actualizarFichas || []) {
        const r = await client.query(
          `UPDATE jugadores SET apoderado_socio = COALESCE($2, apoderado_socio),
                                correo_apoderado = CASE WHEN COALESCE(TRIM(correo_apoderado), '') = '' THEN COALESCE($3, correo_apoderado) ELSE correo_apoderado END,
                                updated_at = NOW()
           WHERE rut_jugador = $1`,
          [rut, cambios.apoderado_socio ?? null, cambios.correo_apoderado ?? null]
        );
        actualizadas += r.rowCount;
      }
    }
    for (const item of plan.agregar) {
      const p = item.pago;
      await client.query(
        `INSERT INTO pagos_mensualidades (rut_jugador, rut_pagos, correo_apoderado, concepto_pago, cantidad_meses_pagados,
                                          meses_correspondientes, monto_total_pagado, estado_pago, fecha_aprobacion, notas_tesoreria)
         VALUES ($1, $2, $3, $4, 1, $5, $6, 'APROBADO', NOW(), $7)`,
        [p.rut_jugador, p.rut_pagos, p.correo_apoderado, p.concepto_pago, p.meses_correspondientes, p.monto_total_pagado, p.notas_tesoreria]
      );
    }
    const ids = borrarDuplicados ? plan.duplicadosBorrar.map((d) => d.id) : [];
    if (ids.length) borrados = (await client.query('DELETE FROM pagos_mensualidades WHERE id = ANY($1::int[])', [ids])).rowCount;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  // Reescribe ya las pestañas de BASE_CCF (antes de soltar el bloqueo de la
  // importación automática, que re-insertaría por id lo borrado).
  if (creados || actualizadas) sheetsSyncManager.enqueueTable('jugadores');
  sheetsSyncManager.enqueueTable('pagos_mensualidades');
  await sheetsSyncManager.flush().catch((e) => console.error('[IMPORTAR-PLANILLA] flush Sheets:', e.message));
  return { creados, actualizadas, agregados: plan.agregar.length, borrados };
};
const CLAVE_IMPORTACION_AUTO = 'importacion_planilla_pagos';
const leerConfigImportacion = async () => {
  await asegurarTablaConfiguracion();
  const r = await pool.query('SELECT valor FROM configuracion_sistema WHERE clave = $1', [CLAVE_IMPORTACION_AUTO]);
  return { url: '', activo: false, ultimaEjecucion: null, ...(r.rows[0]?.valor || {}) };
};
const guardarConfigImportacion = async (cambios, actor = null) => {
  const actual = await leerConfigImportacion();
  const nuevo = { ...actual, ...cambios };
  await pool.query(
    `INSERT INTO configuracion_sistema (clave, valor, actualizado_por, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_por = COALESCE(EXCLUDED.actualizado_por, configuracion_sistema.actualizado_por), updated_at = NOW()`,
    [CLAVE_IMPORTACION_AUTO, JSON.stringify(nuevo), actor]
  );
  return nuevo;
};

const ejecutarImportacionAutomatica = async () => {
  const config = await leerConfigImportacion().catch(() => null);
  if (!config?.activo || !config.url || estadoSincronizacionSheets.isSheetsSyncRunning) return null;
  estadoSincronizacionSheets.isSheetsSyncRunning = true;
  let resultado;
  try {
    const plan = await construirPlanImportacionPagos(config.url);
    const hayCambios = plan.agregar.length + (plan.crearDeportistas || []).length > 0;
    const aplicado = hayCambios ? await aplicarPlanImportacionPagos(plan, { borrarDuplicados: false }) : { creados: 0, agregados: 0, borrados: 0 };
    resultado = {
      fecha: new Date().toISOString(), ok: true, ...aplicado,
      omitidos: plan.resumen.omitidos, duplicadosPendientes: plan.resumen.duplicadosBorrar,
    };
    if (hayCambios) console.log(`[IMPORTAR-PLANILLA][AUTO] ${aplicado.creados} deportistas creados, ${aplicado.agregados} pagos agregados.`);
  } catch (error) {
    resultado = { fecha: new Date().toISOString(), ok: false, error: error.message };
    console.error('[IMPORTAR-PLANILLA][AUTO]', error.message);
  } finally {
    estadoSincronizacionSheets.isSheetsSyncRunning = false;
  }
  await guardarConfigImportacion({ ultimaEjecucion: resultado }).catch(() => {});
  return resultado;
};
// Cada 30 min, desfasado del cron de BASE_CCF (*/10).
cron.schedule('5,35 * * * *', () => { void ejecutarImportacionAutomatica(); });

module.exports = {
  leerConfigImportacion,
  construirPlanImportacionPagos,
  guardarConfigImportacion,
  ejecutarImportacionAutomatica,
  aplicarPlanImportacionPagos,
};
