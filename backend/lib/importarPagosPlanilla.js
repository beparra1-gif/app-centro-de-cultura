// Importa a pagos_mensualidades los pagos 2026 de la planilla de Tesorería
// del club (hojas "Pagos deportistas" y "Pagos Socio") que todavía no estén
// en la base, y limpia pagos duplicados. Todo es un PLAN puro (testeable);
// server.js solo lee la planilla, consulta la base y aplica el plan en una
// transacción cuando el super admin confirma.
//
// Reglas (acordadas con el club 2026-11-07):
//  - Deportistas: RUT completo = columna D, mes = columna E.
//  - Socios: RUT = columna C (si viene vacía, la columna F "RUT 2"), mes = D.
//  - Un pago de la planilla se considera "ya en la base" si existe cualquier
//    pago no rechazado del mismo RUT, mes y tipo (mensualidad o cuota socio).
//  - Duplicados en la base: mismo RUT, mes, tipo y monto. Los registrados
//    desde la app NUNCA se borran; de los importados se deja uno solo.

const ANIO = 2026;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const normalizarRut = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();
const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// CSV (RFC 4180) → arreglo de filas.
const parsearCsv = (texto = '') => {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  const s = String(texto || '').replace(new RegExp('^' + String.fromCharCode(0xFEFF)), ''); // sin BOM
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (comillas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i += 1; } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila); }
  return filas;
};

// "Enero", "ene", "enero-2026" → 1..12
const mesDesdeTexto = (texto = '') => {
  const t = sinTildes(texto).slice(0, 3);
  if (!t) return null;
  const idx = MESES.findIndex((m) => m.startsWith(t));
  return idx >= 0 ? idx + 1 : null;
};

// meses_correspondientes de la base ("abril-2026", "Enero 2026",
// "Febrero-Abril 2026") → [{ mes, anio }], expandiendo rangos.
const mesesDePagoDb = (texto = '') => {
  const t = String(texto || '').trim();
  if (!t) return [];
  const anio = Number((t.match(/(20\d{2})/) || [])[1]) || ANIO;
  const sinAnio = t.replace(/20\d{2}/g, ' ').replace(/,/g, ' ');
  const partes = sinAnio.split(/\s+/).filter(Boolean);
  const meses = [];
  partes.forEach((parte) => {
    const [ini, fin] = parte.split('-');
    const a = mesDesdeTexto(ini);
    const b = mesDesdeTexto(fin || '');
    if (a && b && a <= b) for (let m = a; m <= b; m += 1) meses.push(m);
    else if (a) meses.push(a);
  });
  return [...new Set(meses)].map((mes) => ({ mes, anio }));
};

const esCuotaSocio = (pago = {}) => sinTildes(pago.concepto_pago).startsWith('mensualidad socio');
const esRechazado = (pago = {}) => ['rechazado', 'anulado'].includes(sinTildes(pago.estado_pago));

// Registrado desde la app: con comprobante subido, estado en minúsculas (los
// importados de planillas vienen "APROBADO"/"VALIDADO") o con notas que deja
// la app al reclasificar.
const esRegistradoEnApp = (pago = {}) => {
  if (String(pago.comprobante_url || '').trim()) return true;
  const estado = String(pago.estado_pago || '').trim();
  if (estado && estado === estado.toLowerCase()) return true;
  return /Reclasificado|Confirmado como cuota de socio/.test(String(pago.notas_tesoreria || ''));
};

const montoNumero = (valor) => {
  const n = Number(String(valor ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Cuota de un deportista para filas sin monto (marcadas VALIDADO): su
// valor_mensualidad con beca/exención; si no tiene, $0 (pagado sin monto).
const cuotaDeportista = (jugador = {}) => {
  if (jugador.exento_mensualidad) return 0;
  const beca = Math.min(100, Math.max(0, Number(jugador.beca) || 0));
  const base = Number(jugador.valor_mensualidad) || 0;
  return Math.round(base * (1 - beca / 100));
};
// Cuota de socio del mes: monto fijo de la cuenta o 0,3 UTM de ese mes.
const cuotaSocio = (cuenta = {}, mes, utmPorMes = {}) => {
  const base = Number(cuenta.monto_mensual_base) || 0;
  if (base > 0) return base;
  const utmCuenta = Number(cuenta.utm_valor_referencia) || 0;
  if (utmCuenta > 0) return Math.round(utmCuenta * 0.3);
  const utm = Number(utmPorMes[mes]) || 0;
  return utm > 0 ? Math.round(utm * 0.3) : 0;
};

const leerFilasPlanilla = (filas, { colRut, colRutAlterno = null, colMes, colMonto, colNombre, colEstado }) => (
  filas.slice(1).map((r, i) => ({
    fila: i + 2,
    rut: normalizarRut(r[colRut]) || (colRutAlterno !== null ? normalizarRut(r[colRutAlterno]) : ''),
    mesTexto: String(r[colMes] || '').trim(),
    mes: mesDesdeTexto(r[colMes]),
    montoTexto: String(r[colMonto] || '').trim(),
    monto: montoNumero(r[colMonto]),
    nombre: String(r[colNombre] || '').trim(),
    estado: sinTildes(r[colEstado]),
  })).filter((f) => f.rut || f.mesTexto || f.nombre)
);

const COLUMNAS = {
  deportistas: { colRut: 3, colMes: 4, colMonto: 7, colNombre: 2, colEstado: 6 },
  socios: { colRut: 2, colRutAlterno: 5, colMes: 3, colMonto: 7, colNombre: 1, colEstado: 6 },
};

// Google devuelve la PRIMERA hoja si el nombre pedido no existe: se valida
// que cada CSV sea la hoja correcta antes de importar nada.
const validarEncabezados = (filas, tipo) => {
  const h = (filas[0] || []).map(sinTildes);
  const ok = tipo === 'deportistas'
    ? h[2]?.includes('deportista') && h[3]?.includes('rut') && h[4]?.includes('mes')
    : h[1]?.includes('socio') && h[2]?.includes('rut') && h[3]?.includes('mes');
  if (!ok) {
    const nombre = tipo === 'deportistas' ? '"Pagos deportistas"' : '"Pagos Socio"';
    throw new Error(`La hoja ${nombre} no tiene las columnas esperadas (revisa el nombre de la pestaña y que la planilla sea la correcta).`);
  }
};

const planificarImportacion = ({
  csvDeportistas = '', csvSocios = '', jugadores = [], cuentas = [], pagos = [], utmPorMes = {},
} = {}) => {
  const filasDeportistas = parsearCsv(csvDeportistas);
  const filasSocios = parsearCsv(csvSocios);
  validarEncabezados(filasDeportistas, 'deportistas');
  validarEncabezados(filasSocios, 'socios');
  const jugadorPorRut = new Map(jugadores.map((j) => [normalizarRut(j.rut_jugador), j]));
  const cuentaPorRut = new Map(cuentas.map((c) => [normalizarRut(c.rut), c]));
  const cuentaPorCorreo = new Map(cuentas
    .filter((c) => String(c.correo || '').includes('@'))
    .map((c) => [String(c.correo).trim().toLowerCase(), c]));

  // Lo que ya hay en la base: tipo|rut|mes (meses de 2026, sin rechazados).
  const enBase = new Set();
  pagos.forEach((p) => {
    if (esRechazado(p)) return;
    const tipo = esCuotaSocio(p) ? 'socio' : 'deportista';
    const rut = normalizarRut(tipo === 'socio' ? p.rut_pagos : (p.rut_jugador || p.rut_pagos));
    if (!rut) return;
    mesesDePagoDb(p.meses_correspondientes).forEach(({ mes, anio }) => {
      if (anio === ANIO) enBase.add(`${tipo}|${rut}|${mes}`);
    });
  });

  const agregar = [];
  const yaEstaban = [];
  const omitidos = [];
  const avisos = [];

  const procesar = (tipo, filas) => {
    // Filas repetidas dentro de la misma planilla (mismo RUT y mes).
    const grupos = new Map();
    filas.forEach((f) => {
      if (f.estado && !['validado', 'aprobado'].includes(f.estado)) {
        omitidos.push({ tipo, ...f, motivo: `Estado "${f.estado}" (solo se importan los VALIDADO)` });
        return;
      }
      if (!f.rut) { omitidos.push({ tipo, ...f, motivo: 'Sin RUT' }); return; }
      if (!f.mes) { omitidos.push({ tipo, ...f, motivo: `Mes no reconocido ("${f.mesTexto}")` }); return; }
      const clave = `${tipo}|${f.rut}|${f.mes}`;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(f);
    });

    grupos.forEach((grupo, clave) => {
      const elegido = grupo.reduce((a, b) => (b.monto > a.monto ? b : a));
      if (grupo.length > 1) {
        const montos = [...new Set(grupo.map((g) => g.monto))];
        avisos.push({
          tipo, rut: elegido.rut, nombre: elegido.nombre, mes: MESES[elegido.mes - 1],
          detalle: montos.length > 1
            ? `Aparece ${grupo.length} veces con montos distintos (${montos.map((m) => `$${m.toLocaleString('es-CL')}`).join(' y ')}); se usa el mayor.`
            : `Aparece ${grupo.length} veces en la planilla; se cuenta una sola vez.`,
          filas: grupo.map((g) => g.fila),
        });
      }
      if (enBase.has(clave)) { yaEstaban.push({ tipo, rut: elegido.rut, nombre: elegido.nombre, mes: MESES[elegido.mes - 1] }); return; }

      if (tipo === 'deportista') {
        const jugador = jugadorPorRut.get(elegido.rut);
        if (!jugador) { omitidos.push({ tipo, ...elegido, motivo: 'El deportista no está en la base (revisa el RUT)' }); return; }
        const pagador = cuentaPorRut.get(normalizarRut(jugador.rut_apoderado))
          || cuentaPorCorreo.get(String(jugador.correo_apoderado || '').trim().toLowerCase())
          || cuentaPorRut.get(normalizarRut(jugador.rut_jugador));
        const sinMonto = !elegido.montoTexto;
        const monto = sinMonto ? cuotaDeportista(jugador) : elegido.monto;
        agregar.push({
          tipo, fila: elegido.fila, rut: jugador.rut_jugador,
          nombre: `${jugador.nombres || ''} ${jugador.apellido_paterno || ''}`.trim() || elegido.nombre,
          mes: MESES[elegido.mes - 1], monto, sinMonto,
          pago: {
            rut_jugador: jugador.rut_jugador,
            rut_pagos: pagador?.rut || jugador.rut_apoderado || null,
            correo_apoderado: jugador.correo_apoderado || pagador?.correo || null,
            concepto_pago: 'Mensualidad',
            meses_correspondientes: `${MESES[elegido.mes - 1]}-${ANIO}`,
            monto_total_pagado: monto,
            notas_tesoreria: `Importado de la planilla de pagos ${ANIO} (Pagos deportistas, fila ${elegido.fila})${sinMonto ? ' · monto no informado en la planilla' : ''}`,
          },
        });
      } else {
        const cuenta = cuentaPorRut.get(elegido.rut);
        if (!cuenta) { omitidos.push({ tipo, ...elegido, motivo: 'No hay una cuenta con ese RUT en la base' }); return; }
        if (!cuenta.es_socio) {
          avisos.push({ tipo, rut: cuenta.rut, nombre: elegido.nombre, mes: MESES[elegido.mes - 1], detalle: 'La cuenta no está marcada como socia: el pago se agrega, pero no se verá en Tesorería hasta marcarla.' });
        }
        const sinMonto = !elegido.montoTexto;
        const monto = sinMonto ? cuotaSocio(cuenta, elegido.mes, utmPorMes) : elegido.monto;
        agregar.push({
          tipo, fila: elegido.fila, rut: cuenta.rut,
          nombre: `${cuenta.nombres || ''} ${cuenta.apellido_paterno || ''}`.trim() || elegido.nombre,
          mes: MESES[elegido.mes - 1], monto, sinMonto,
          pago: {
            rut_jugador: null,
            rut_pagos: cuenta.rut,
            correo_apoderado: cuenta.correo || null,
            concepto_pago: 'Mensualidad Socio',
            meses_correspondientes: `${MESES[elegido.mes - 1]}-${ANIO}`,
            monto_total_pagado: monto,
            notas_tesoreria: `Importado de la planilla de pagos ${ANIO} (Pagos Socio, fila ${elegido.fila})${sinMonto ? ' · monto no informado en la planilla: cuota del mes' : ''}`,
          },
        });
      }
    });
  };

  procesar('deportista', leerFilasPlanilla(filasDeportistas, COLUMNAS.deportistas));
  procesar('socio', leerFilasPlanilla(filasSocios, COLUMNAS.socios));

  // Duplicados en la base: mismo tipo, RUT, mes (un solo mes) y monto.
  const gruposDb = new Map();
  pagos.forEach((p) => {
    if (esRechazado(p)) return;
    const meses = mesesDePagoDb(p.meses_correspondientes);
    if (meses.length !== 1) return; // rangos legacy: no se tocan
    const tipo = esCuotaSocio(p) ? 'socio' : 'deportista';
    const rut = normalizarRut(tipo === 'socio' ? p.rut_pagos : (p.rut_jugador || p.rut_pagos));
    if (!rut) return;
    const clave = `${tipo}|${rut}|${meses[0].anio}-${meses[0].mes}|${Math.round(Number(p.monto_total_pagado) || 0)}`;
    if (!gruposDb.has(clave)) gruposDb.set(clave, []);
    gruposDb.get(clave).push(p);
  });
  const duplicadosBorrar = [];
  gruposDb.forEach((grupo) => {
    if (grupo.length < 2) return;
    const deApp = grupo.filter(esRegistradoEnApp);
    const importados = grupo.filter((p) => !esRegistradoEnApp(p)).sort((a, b) => Number(a.id) - Number(b.id));
    const sobran = deApp.length > 0 ? importados : importados.slice(1);
    sobran.forEach((p) => {
      const tipo = esCuotaSocio(p) ? 'socio' : 'deportista';
      const ref = tipo === 'socio' ? cuentaPorRut.get(normalizarRut(p.rut_pagos)) : jugadorPorRut.get(normalizarRut(p.rut_jugador));
      duplicadosBorrar.push({
        id: p.id, tipo,
        rut: tipo === 'socio' ? p.rut_pagos : p.rut_jugador,
        nombre: ref ? `${ref.nombres || ''} ${ref.apellido_paterno || ''}`.trim() : '',
        mes: p.meses_correspondientes, monto: Number(p.monto_total_pagado) || 0,
        seQueda: deApp.length > 0 ? 'el registrado desde la app' : `el pago #${importados[0].id}`,
      });
    });
  });

  const contar = (lista, tipo) => lista.filter((x) => x.tipo === tipo).length;
  return {
    resumen: {
      agregarDeportistas: contar(agregar, 'deportista'),
      agregarSocios: contar(agregar, 'socio'),
      yaEstaban: yaEstaban.length,
      omitidos: omitidos.length,
      duplicadosBorrar: duplicadosBorrar.length,
      montoAgregar: agregar.reduce((s, a) => s + a.monto, 0),
    },
    agregar, yaEstaban, omitidos, avisos, duplicadosBorrar,
  };
};

module.exports = {
  planificarImportacion,
  parsearCsv,
  mesesDePagoDb,
  esRegistradoEnApp,
  normalizarRut,
};
