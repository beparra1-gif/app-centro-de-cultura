// Valor UTM: caché, consulta a mindicador.cl y tabla utm_mensual.
// Extraído de server.js sin cambios de comportamiento.
const { pool, sheetsSyncManager } = require('./db');

// Recalcula la UTM histórica del año en curso — pisa (UPDATE) cada fila
// con el valor real de mindicador.cl aunque ya existiera guardada. Nace de
// un caso real: algunos meses de utm_mensual habían quedado con un valor
// placeholder (68000, de antes de que existiera el fetch real) y como
// obtenerUTMParaMes normalmente nunca vuelve a tocar una fila que ya
// existe (ver su comentario), la cuota de socio de esos meses quedaba mal
// para siempre sin que nadie lo notara. Se corre una vez al arrancar el
// servidor (corrige de inmediato en el próximo deploy) y de ahí en
// adelante el día 1 de cada mes, sin depender de que un admin entre a
// apretar el botón manual de Auditoría.
const recalcularUtmHistoricaAnioActual = async () => {
  const anio = new Date().getFullYear();
  const mesTope = new Date().getMonth() + 1;
  for (let mes = 1; mes <= mesTope; mes += 1) {
    await obtenerUTMParaMes(anio, mes, { forzarRecalculo: true });
  }
  sheetsSyncManager.enqueueTable('utm_mensual');
};

// UTM (Unidad Tributaria Mensual) real, consultada a mindicador.cl — antes
// getUTMLastDayPreviousMonth (src/utils/appHelpers.js) era una tabla fija a
// mano que ni siquiera distinguía año (mismo valor para "agosto 2025" y
// "agosto 2026"). La cuota socio (0.3 UTM) depende de que este número sea
// real y se actualice solo — se consulta con el valor del ÚLTIMO DÍA DEL MES
// ANTERIOR (mismo criterio que ya usaba appHelpers), y se cachea en memoria
// por mes calendario para no golpear la API externa en cada request: el
// valor no cambia dentro del mismo mes, así que basta refrescarlo una vez
// al mes (o al reiniciar el server).
let utmCache = { claveMes: null, valor: null, fechaConsultada: null, actualizadoEn: null };
const UTM_FALLBACK_ULTIMO_CONOCIDO = 71649; // agosto 2026 — solo si la API externa y el caché fallan a la vez.

const calcularUltimoDiaMesAnterior = () => {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 0);
};

const formatearFechaMindicador = (fecha) => {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${fecha.getFullYear()}`;
};

// UTM que corresponde cobrar en (anioObjetivo, mesObjetivo): la vigente al
// último día del mes ANTERIOR (misma regla de negocio que obtenerUTMVigente,
// pero aplicada al mes que se está cobrando, no al mes calendario actual).
// Enero pide el corte de diciembre del año anterior.
const obtenerUTMParaMes = async (anioObjetivo, mesObjetivo, opciones = {}) => {
  const { forzarRecalculo = false } = opciones;
  const anio = Number(anioObjetivo);
  const mes = Number(mesObjetivo);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return { anio, mes, valor: null, error: 'Mes/año inválido' };
  }

  if (!forzarRecalculo) {
    const existente = await pool.query('SELECT * FROM utm_mensual WHERE anio = $1 AND mes = $2', [anio, mes]);
    if (existente.rows.length > 0) {
      const fila = existente.rows[0];
      return { anio, mes, valor: Number(fila.valor), fechaCorte: fila.fecha_corte, fuente: fila.fuente };
    }
  }

  const fechaCorte = mes === 1
    ? new Date(anio - 1, 11, 31)
    : new Date(anio, mes - 1, 0);

  try {
    const fechaTexto = formatearFechaMindicador(fechaCorte);
    const respuesta = await fetch(`https://mindicador.cl/api/utm/${fechaTexto}`);
    if (!respuesta.ok) throw new Error(`mindicador.cl respondió ${respuesta.status}`);
    const datos = await respuesta.json();
    const valor = Number(datos?.serie?.[0]?.valor);
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Respuesta de mindicador.cl sin un valor de UTM válido.');

    // ON CONFLICT DO UPDATE (no DO NOTHING): un recálculo forzado tiene que
    // poder pisar una fila existente con datos viejos/incorrectos (ver
    // /api/admin/utm-historico/recalcular), no solo insertar cuando falta.
    await pool.query(
      `INSERT INTO utm_mensual (anio, mes, valor, fecha_corte, fuente) VALUES ($1, $2, $3, $4, 'mindicador.cl')
       ON CONFLICT (anio, mes) DO UPDATE SET valor = EXCLUDED.valor, fecha_corte = EXCLUDED.fecha_corte, fuente = EXCLUDED.fuente`,
      [anio, mes, valor, fechaCorte.toISOString().slice(0, 10)]
    );
    // Esto pasa dentro de un GET (/api/utm-vigente, /api/utm-historico) — el
    // middleware genérico de auto-export solo mira métodos mutantes
    // (POST/PUT/PATCH/DELETE), así que un INSERT real acá nunca se
    // encolaría solo si no se avisa a mano.
    sheetsSyncManager.enqueueTable('utm_mensual');
    return { anio, mes, valor, fechaCorte: fechaCorte.toISOString().slice(0, 10), fuente: 'mindicador.cl' };
  } catch (err) {
    console.error(`[obtenerUTMParaMes] Error consultando UTM de corte para ${anio}-${mes}:`, err.message);
    return { anio, mes, valor: null, fechaCorte: fechaCorte.toISOString().slice(0, 10), error: err.message };
  }
};

const obtenerUTMVigente = async () => {
  const fechaObjetivo = calcularUltimoDiaMesAnterior();
  const claveMes = `${fechaObjetivo.getFullYear()}-${fechaObjetivo.getMonth() + 1}`;
  if (utmCache.claveMes === claveMes && Number.isFinite(utmCache.valor)) {
    return utmCache;
  }
  try {
    const fechaTexto = formatearFechaMindicador(fechaObjetivo);
    const respuesta = await fetch(`https://mindicador.cl/api/utm/${fechaTexto}`);
    if (!respuesta.ok) throw new Error(`mindicador.cl respondió ${respuesta.status}`);
    const datos = await respuesta.json();
    const valor = Number(datos?.serie?.[0]?.valor);
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Respuesta de mindicador.cl sin un valor de UTM válido.');
    utmCache = {
      claveMes,
      valor,
      fechaConsultada: fechaObjetivo.toISOString().slice(0, 10),
      actualizadoEn: new Date().toISOString(),
    };
    return utmCache;
  } catch (err) {
    console.error('[obtenerUTMVigente] Error consultando mindicador.cl:', err.message);
    // Caché de un mes anterior sirve mejor que un valor fijo desactualizado
    // años atrás; solo cae al fallback fijo si nunca se logró consultar.
    if (Number.isFinite(utmCache.valor)) return { ...utmCache, claveMes, esCacheAnterior: true };
    return { claveMes, valor: UTM_FALLBACK_ULTIMO_CONOCIDO, fechaConsultada: null, actualizadoEn: null, esFallback: true };
  }
};

module.exports = {
  recalcularUtmHistoricaAnioActual,
  obtenerUTMVigente,
  obtenerUTMParaMes,
};
