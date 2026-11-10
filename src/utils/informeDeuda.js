// Informes de Tesorería: estado de cada mes del año por deportista (agrupado
// por categoría) y por socio. La deuda viene de los mismos cálculos que
// "Por cobrar" (App.jsx: construirMorososDesdePagos / construirSociosMorosos),
// así que los números coinciden; aquí solo se arma la grilla mes a mes.

import { partesFechaCalendario } from './fechas';
import { noDebeMensualidad, obtenerPorcentajeBeca } from './beca';

export const ANIO_INFORME = 2026;
export const MESES_INFORME = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// pagado | condonado | debe | parcial | exento | no-aplica (antes de su
// ingreso) | en-curso (mes actual, aún no vence) | futuro
export const ETIQUETA_ESTADO = {
  pagado: 'Pagado', condonado: 'Condonado', debe: 'Debe', parcial: 'Abono parcial', exento: 'Exento / beca 100%',
  'no-aplica': 'No corresponde', 'en-curso': 'Mes en curso', futuro: 'Próximo',
};

const normalizarRut = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();
const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const mesDesdeTexto = (texto = '') => {
  const idx = MESES_INFORME.findIndex((m) => sinTildes(m) === sinTildes(texto).slice(0, 3));
  return idx >= 0 ? idx + 1 : null;
};

// Mes hasta el que se cobra (como en App.jsx: el mes en curso aún no vence).
export const limitesInforme = (hoy = new Date()) => {
  const anio = hoy.getFullYear();
  if (anio > ANIO_INFORME) return { limite: 12, mesActual: 13 };
  if (anio < ANIO_INFORME) return { limite: 0, mesActual: 0 };
  return { limite: hoy.getMonth(), mesActual: hoy.getMonth() + 1 };
};

// Mismas reglas que getAnioIngreso/getMesIngreso (App.jsx).
export const inicioCobroJugador = (j = {}) => {
  let anio = [j.anio_ingreso, j['año_ingreso']].map(Number).find((n) => Number.isFinite(n) && n >= 2000 && n <= 2100);
  if (!anio) anio = Number((String(j.fecha_ingreso || '').match(/(20\d{2})/) || [])[1]) || ANIO_INFORME;
  if (anio > ANIO_INFORME) return 13;
  if (anio < ANIO_INFORME) return 1;
  return mesDesdeTexto(j.mes_inicio_cobro) || partesFechaCalendario(j.fecha_ingreso)?.mes || 1;
};
export const inicioCobroSocio = (c = {}) => {
  const desdeCampo = mesDesdeTexto(c.mes_inicio_cobro);
  if (desdeCampo) return desdeCampo;
  const partes = partesFechaCalendario(c.fecha_ingreso_socio);
  if (!partes) return 1;
  if (partes.anio > ANIO_INFORME) return 13;
  if (partes.anio < ANIO_INFORME) return 1;
  return partes.mes;
};

// Meses condonados: pago aprobado de $0 (así se registra una condonación).
// Devuelve Map rut → Set(mes 1..12) del concepto pedido.
const mesesCondonados = (pagos = [], tipo) => {
  const porRut = new Map();
  (pagos || []).forEach((p) => {
    const estado = String(p.estado_pago || '').toLowerCase();
    if (!['aprobado', 'validado'].includes(estado) || Number(p.monto_total_pagado) > 0) return;
    const esSocio = sinTildes(p.concepto_pago).startsWith('mensualidad socio');
    if ((tipo === 'socio') !== esSocio) return;
    const texto = String(p.meses_correspondientes || '');
    const anio = Number((texto.match(/(20\d{2})/) || [])[1]) || ANIO_INFORME;
    const mes = mesDesdeTexto(texto);
    const rut = normalizarRut(tipo === 'socio' ? p.rut_pagos : (p.rut_jugador || p.rut_pagos));
    if (!mes || anio !== ANIO_INFORME || !rut) return;
    if (!porRut.has(rut)) porRut.set(rut, new Set());
    porRut.get(rut).add(mes);
  });
  return porRut;
};

const estadosDelAnio = ({ inicio, deuda, exento, limite, mesActual, condonados = new Set() }) => {
  const morosos = new Set(deuda?.mesesMorosos || []);
  const parciales = new Set(deuda?.mesesParciales || []);
  return MESES_INFORME.map((nombre, i) => {
    const mes = i + 1;
    if (mes < inicio) return 'no-aplica';
    if (mes === mesActual) return 'en-curso';
    if (mes > limite) return 'futuro';
    if (exento) return 'exento';
    if (parciales.has(nombre)) return 'parcial';
    if (morosos.has(nombre)) return 'debe';
    return condonados.has(mes) ? 'condonado' : 'pagado';
  });
};

export const construirInformeDeportistas = ({ jugadores = [], morosos = [], pagos = [], hoy = new Date() } = {}) => {
  const { limite, mesActual } = limitesInforme(hoy);
  const condonadosPorRut = mesesCondonados(pagos, 'deportista');
  const deudaPorRut = new Map((morosos || []).map((m) => [normalizarRut(m.rut), m]));
  return (jugadores || [])
    .filter((j) => normalizarRut(j.rut_jugador))
    .map((j) => {
      const deuda = deudaPorRut.get(normalizarRut(j.rut_jugador));
      const exento = noDebeMensualidad(j);
      return {
        id: normalizarRut(j.rut_jugador),
        rut: j.rut_jugador,
        nombre: `${j.nombres || ''} ${j.apellido_paterno || ''}`.trim() || j.rut_jugador,
        rama: String(j.rama || '').trim().toUpperCase() || 'SIN RAMA',
        categoria: String(j.categoria || '').trim().toUpperCase() || 'SIN CATEGORÍA',
        beca: obtenerPorcentajeBeca(j),
        estados: estadosDelAnio({ inicio: inicioCobroJugador(j), deuda, exento, limite, mesActual, condonados: condonadosPorRut.get(normalizarRut(j.rut_jugador)) }),
        mesesDeuda: Number(deuda?.mesesDeuda || 0),
        montoDeuda: Number(deuda?.montoDeuda || 0),
      };
    });
};

export const construirInformeSocios = ({ cuentas = [], sociosMorosos = [], pagos = [], hoy = new Date() } = {}) => {
  const { limite, mesActual } = limitesInforme(hoy);
  const condonadosPorRut = mesesCondonados(pagos, 'socio');
  const deudaPorRut = new Map((sociosMorosos || []).map((s) => [normalizarRut(s.rut), s]));
  return (cuentas || [])
    .filter((c) => c.es_socio && normalizarRut(c.rut))
    .map((c) => {
      const deuda = deudaPorRut.get(normalizarRut(c.rut));
      return {
        id: normalizarRut(c.rut),
        rut: c.rut,
        nombre: `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.rut,
        estados: estadosDelAnio({ inicio: inicioCobroSocio(c), deuda, exento: false, limite, mesActual, condonados: condonadosPorRut.get(normalizarRut(c.rut)) }),
        mesesDeuda: Number(deuda?.mesesDeuda || 0),
        montoDeuda: Number(deuda?.montoDeuda || 0),
      };
    });
};

// "SUB-9" < "SUB-11" < "SUB-17 / SUB-18" < sin categoría.
export const ordenarCategorias = (a, b) => {
  const n = (t) => Number((String(t).match(/\d+/) || [])[0]) || 999;
  return n(a) - n(b) || String(a).localeCompare(String(b), 'es');
};

export const filtrarInforme = (filas = [], { texto = '', rama = 'todas', categoria = 'todas', estado = 'todos', mes = 'todos' } = {}) => {
  const q = sinTildes(texto.trim());
  const idxMes = mes === 'todos' ? -1 : MESES_INFORME.indexOf(mes);
  return filas.filter((f) => {
    if (rama !== 'todas' && f.rama !== rama) return false;
    if (categoria !== 'todas' && f.categoria !== categoria) return false;
    if (estado === 'con_deuda' && f.mesesDeuda <= 0) return false;
    if (estado === 'al_dia' && f.mesesDeuda > 0) return false;
    if (idxMes >= 0 && !['debe', 'parcial'].includes(f.estados[idxMes])) return false;
    if (q && !sinTildes(`${f.nombre} ${f.rut}`).includes(q)) return false;
    return true;
  });
};

// [{ categoria, filas, mesesDeuda, montoDeuda }] ordenado por categoría.
export const agruparPorCategoria = (filas = []) => {
  const grupos = new Map();
  filas.forEach((f) => {
    if (!grupos.has(f.categoria)) grupos.set(f.categoria, []);
    grupos.get(f.categoria).push(f);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => ordenarCategorias(a, b))
    .map(([categoria, lista]) => ({
      categoria,
      filas: lista.sort((x, y) => (y.mesesDeuda - x.mesesDeuda) || x.nombre.localeCompare(y.nombre, 'es')),
      mesesDeuda: lista.reduce((s, f) => s + f.mesesDeuda, 0),
      montoDeuda: lista.reduce((s, f) => s + f.montoDeuda, 0),
      conDeuda: lista.filter((f) => f.mesesDeuda > 0).length,
    }));
};
