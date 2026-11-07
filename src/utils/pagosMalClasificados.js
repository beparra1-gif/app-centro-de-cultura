// Pagos de deportistas guardados por error como cuota de socio.
//
// Hasta 2026-11-06, el pago manual (PagoForm) ponía concepto "Mensualidad
// Socio" a la mensualidad de un HIJO cuando su apoderado era socio. Esos
// pagos se cuentan como cuota de socio del apoderado (por rut_pagos) y el
// hijo sigue apareciendo moroso. Se detectan porque llevan el RUT de un
// deportista distinto a quien paga. No se corrigen solos: algún pago
// antiguo pudo guardarse así a propósito, así que un admin decide uno a uno.

import { normalizarRutTesoreria } from './tesoreriaCuentas';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const esConceptoCuotaSocio = (pago = {}) => String(pago.concepto_pago || '').trim().toLowerCase().startsWith('mensualidad socio');

// "Enero 2026", "ene-2026", "Enero-Marzo 2026" → { mes, anio, clave } del primer mes.
export const mesDelPago = (pago = {}) => {
  const texto = String(pago.meses_correspondientes || '').trim();
  const token = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .slice(0, 3);
  const idx = MESES.indexOf(token);
  if (idx < 0) return null;
  const anio = Number((texto.match(/(20\d{2})/) || [])[1]) || null;
  return { mes: idx + 1, anio, clave: `${anio || ''}-${idx + 1}`, texto: `${NOMBRES_MESES[idx]}${anio ? ` ${anio}` : ''}` };
};

const nombre = (o = {}) => `${o.nombres || ''} ${o.apellido_paterno || ''}`.trim();

export const detectarPagosMalClasificados = ({ pagos = [], jugadores = [], cuentas = [] } = {}) => {
  const jugadorPorRut = new Map((jugadores || []).map((j) => [normalizarRutTesoreria(j.rut_jugador), j]));
  const cuentaPorRut = new Map((cuentas || []).map((c) => [normalizarRutTesoreria(c.rut), c]));
  const estadoValido = (p) => !['rechazado', 'anulado'].includes(String(p.estado_pago || '').toLowerCase());

  const sospechoso = (p) => {
    if (!esConceptoCuotaSocio(p) || !estadoValido(p)) return false;
    const rutJugador = normalizarRutTesoreria(p.rut_jugador);
    if (!rutJugador || rutJugador === normalizarRutTesoreria(p.rut_pagos)) return false;
    return jugadorPorRut.has(rutJugador);
  };

  // Cuota de socio del mismo mes registrada aparte (sin RUT de deportista):
  // si existe, el pago sospechoso casi seguro era la mensualidad del hijo.
  const cuotaSocioAparte = new Set();
  (pagos || []).forEach((p) => {
    if (!esConceptoCuotaSocio(p) || !estadoValido(p) || sospechoso(p)) return;
    const mes = mesDelPago(p);
    const rutPagos = normalizarRutTesoreria(p.rut_pagos);
    if (mes && rutPagos) cuotaSocioAparte.add(`${rutPagos}|${mes.clave}`);
  });

  return (pagos || [])
    .filter(sospechoso)
    .map((p) => {
      const jugador = jugadorPorRut.get(normalizarRutTesoreria(p.rut_jugador));
      const rutPagos = normalizarRutTesoreria(p.rut_pagos);
      const pagador = rutPagos ? cuentaPorRut.get(rutPagos) : null;
      const mes = mesDelPago(p);
      return {
        id: p.id,
        pago: p,
        deportista: nombre(jugador) || p.rut_jugador,
        rutDeportista: p.rut_jugador,
        pagador: pagador ? nombre(pagador) : '',
        rutPagador: p.rut_pagos || '',
        pagadorEsSocio: Boolean(pagador?.es_socio),
        mes: mes?.texto || String(p.meses_correspondientes || 'Sin mes'),
        monto: Number(p.monto_total_pagado) || 0,
        estado: String(p.estado_pago || '').toLowerCase(),
        cuotaSocioPagadaAparte: Boolean(mes && rutPagos && cuotaSocioAparte.has(`${rutPagos}|${mes.clave}`)),
      };
    })
    .sort((a, b) => a.pagador.localeCompare(b.pagador, 'es') || String(a.id).localeCompare(String(b.id), 'es', { numeric: true }));
};

// Cuerpo completo para PUT /api/pagos-mensualidades/:id (el endpoint
// reescribe todas las columnas editables), con los cambios y una nota.
export const payloadReclasificacion = (pago = {}, accion, autor = '', fecha = new Date()) => {
  const dia = fecha.toLocaleDateString('es-CL');
  const notaBase = String(pago.notas_tesoreria || '').trim();
  const cambios = accion === 'mensualidad'
    ? { concepto_pago: 'Mensualidad', nota: `Reclasificado de "Mensualidad Socio" a "Mensualidad" del deportista` }
    : { rut_jugador: null, nota: 'Confirmado como cuota de socio (se quitó el RUT del deportista)' };
  return {
    rut_jugador: 'rut_jugador' in cambios ? cambios.rut_jugador : pago.rut_jugador,
    rut_pagos: pago.rut_pagos,
    correo_apoderado: pago.correo_apoderado,
    concepto_pago: cambios.concepto_pago || pago.concepto_pago,
    cantidad_meses_pagados: pago.cantidad_meses_pagados,
    meses_correspondientes: pago.meses_correspondientes,
    monto_total_pagado: pago.monto_total_pagado,
    comprobante_url: pago.comprobante_url,
    notas_tesoreria: [notaBase, `[${cambios.nota}${autor ? ` por ${autor}` : ''} el ${dia}]`].filter(Boolean).join(' '),
  };
};
