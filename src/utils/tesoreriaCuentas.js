// Tesorería: una fila por cada PERSONA QUE PAGA algo (no por deportista).
//
// Una misma cuenta puede deber conceptos independientes: la cuota de socio
// (si es socia) y la mensualidad de cada pupilo a su cargo. Antes Tesorería
// los mostraba en listas separadas (morosos por deportista y socios
// morosos), así que una socia-apoderada con 2 hijos aparecía repartida en
// 3 lugares y no se veía de un vistazo qué debía cada familia.
//
// Las deudas ya vienen calculadas (App.jsx): `morosos` por deportista
// (construirMorososDesdePagos) y `sociosMorosos` por cuenta
// (construirSociosMorosos). Aquí solo se agrupan por quien paga.

import { normalizarRol } from '../security/accessControl';

export const normalizarRutTesoreria = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
const normalizarCorreo = (correo = '') => String(correo || '').trim().toLowerCase();
const normalizarTexto = (texto = '') => String(texto || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

export const ETIQUETA_PERFIL_TESORERIA = {
  super_admin: 'Super admin',
  admin: 'Admin',
  directiva: 'Directiva',
  socio: 'Socio',
  socio_apoderado: 'Socio / Apoderado',
  apoderado: 'Apoderado',
  jugador: 'Deportista',
  staff: 'Staff',
};

const nombreCuenta = (cuenta = {}) => (
  `${cuenta.nombres || ''} ${cuenta.apellido_paterno || ''}`.trim() || `Cuenta ${cuenta.rut || ''}`.trim()
);
const nombreJugador = (jugador = {}) => (
  `${jugador.nombres || ''} ${jugador.apellido_paterno || ''}`.trim() || `Deportista ${jugador.rut_jugador || ''}`.trim()
);
const telefonoCuenta = (cuenta = {}) => {
  const telefono = String(cuenta?.telefono || '').replace(/\s+/g, '').trim();
  if (!telefono) return '';
  // Algunas cuentas ya guardan el número con prefijo (+569…): no duplicarlo.
  return telefono.startsWith('+') ? telefono : `${String(cuenta?.prefijo_tel || '+56').trim()}${telefono}`;
};

// Quién paga la mensualidad de un deportista: la cuenta de su apoderado
// (por RUT o, si falta, por correo); si no tiene, su propia cuenta
// (deportista mayor de edad que se autogestiona). Mismo criterio de
// vínculo que obtenerPupilosDeActor (backend) y construirMorososDesdePagos.
export const resolverPagadorDeJugador = (jugador = {}, { cuentaPorRut, cuentaPorCorreo }) => (
  cuentaPorRut.get(normalizarRutTesoreria(jugador.rut_apoderado))
  || cuentaPorCorreo.get(normalizarCorreo(jugador.correo_apoderado))
  || cuentaPorRut.get(normalizarRutTesoreria(jugador.rut_jugador))
  || null
);

export const construirCuentasQuePagan = ({ cuentas = [], jugadores = [], morosos = [], sociosMorosos = [] } = {}) => {
  const cuentaPorRut = new Map();
  const cuentaPorCorreo = new Map();
  (cuentas || []).forEach((cuenta) => {
    const rut = normalizarRutTesoreria(cuenta?.rut);
    if (rut) cuentaPorRut.set(rut, cuenta);
    const correo = normalizarCorreo(cuenta?.correo);
    if (correo && !correo.endsWith('@actualizar.local')) cuentaPorCorreo.set(correo, cuenta);
  });
  const deudaJugador = new Map((morosos || []).map((m) => [normalizarRutTesoreria(m.rut), m]));
  const deudaSocio = new Map((sociosMorosos || []).map((s) => [normalizarRutTesoreria(s.rut), s]));

  const pupilosPorCuenta = new Map();
  const sinResponsable = [];
  (jugadores || []).forEach((jugador) => {
    const rutJugador = normalizarRutTesoreria(jugador?.rut_jugador);
    if (!rutJugador) return;
    const deuda = deudaJugador.get(rutJugador);
    const linea = {
      clave: `jugador-${rutJugador}`,
      jugador,
      rut: jugador.rut_jugador,
      nombre: nombreJugador(jugador),
      rama: jugador.rama || '',
      categoria: jugador.categoria || '',
      beca: Number(jugador.beca || 0) || 0,
      exento: Boolean(jugador.exento_mensualidad),
      deuda: Number(deuda?.montoDeuda || 0),
      mesesDeuda: Number(deuda?.mesesDeuda || 0),
      mesesMorosos: deuda?.mesesMorosos || [],
    };
    const pagador = resolverPagadorDeJugador(jugador, { cuentaPorRut, cuentaPorCorreo });
    if (!pagador) {
      sinResponsable.push(linea);
      return;
    }
    const rutPagador = normalizarRutTesoreria(pagador.rut);
    linea.autogestionado = rutPagador === rutJugador;
    if (!pupilosPorCuenta.has(rutPagador)) pupilosPorCuenta.set(rutPagador, []);
    pupilosPorCuenta.get(rutPagador).push(linea);
  });

  const filas = [];
  (cuentas || []).forEach((cuenta) => {
    const rut = normalizarRutTesoreria(cuenta?.rut);
    if (!rut) return;
    const pupilos = pupilosPorCuenta.get(rut) || [];
    const esSocio = Boolean(cuenta.es_socio);
    if (!esSocio && pupilos.length === 0) return; // no paga ninguna cuota

    const deudaS = esSocio ? deudaSocio.get(rut) : null;
    const socio = esSocio
      ? {
        clave: `socio-${rut}`,
        deuda: Number(deudaS?.montoDeuda || 0),
        mesesDeuda: Number(deudaS?.mesesDeuda || 0),
        mesesMorosos: deudaS?.mesesMorosos || [],
      }
      : null;
    const rol = normalizarRol(cuenta.rol || cuenta.perfil_principal || '');
    const autogestionado = pupilos.some((p) => p.autogestionado);
    const deApoderado = pupilos.filter((p) => !p.autogestionado);

    const perfiles = [];
    if (ETIQUETA_PERFIL_TESORERIA[rol] && !['socio', 'apoderado', 'socio_apoderado', 'jugador'].includes(rol)) {
      perfiles.push(ETIQUETA_PERFIL_TESORERIA[rol]);
    }
    if (esSocio) perfiles.push('Socio');
    if (deApoderado.length > 0) perfiles.push(deApoderado.length === 1 ? 'Apoderado de 1' : `Apoderado de ${deApoderado.length}`);
    if (autogestionado) perfiles.push('Deportista (paga sus cuotas)');

    const deudaTotal = (socio?.deuda || 0) + pupilos.reduce((s, p) => s + p.deuda, 0);
    const mesesDeudaTotal = (socio?.mesesDeuda || 0) + pupilos.reduce((s, p) => s + p.mesesDeuda, 0);
    filas.push({
      id: `cuenta-${rut}`,
      tipo: 'cuenta',
      cuenta,
      rut: cuenta.rut,
      nombre: nombreCuenta(cuenta),
      rol,
      perfiles,
      esSocio,
      esApoderado: deApoderado.length > 0,
      autogestionado,
      socio,
      pupilos,
      telefono: telefonoCuenta(cuenta),
      correo: cuenta.correo || '',
      deudaTotal,
      mesesDeudaTotal,
      textoBusqueda: normalizarTexto([
        nombreCuenta(cuenta), cuenta.rut, cuenta.correo, cuenta.telefono,
        ...pupilos.flatMap((p) => [p.nombre, p.rut]),
      ].join(' ')),
    });
  });

  // Deportistas sin ninguna cuenta que pague por ellos: se muestran igual
  // (su deuda existe) con la alerta de que falta vincular al responsable.
  sinResponsable.forEach((linea) => {
    filas.push({
      id: `sin-responsable-${normalizarRutTesoreria(linea.rut)}`,
      tipo: 'sin_responsable',
      cuenta: null,
      rut: linea.rut,
      nombre: linea.nombre,
      rol: '',
      perfiles: ['Sin responsable de pago'],
      esSocio: false,
      esApoderado: false,
      autogestionado: false,
      socio: null,
      pupilos: [linea],
      telefono: '',
      correo: linea.jugador?.correo_apoderado || '',
      deudaTotal: linea.deuda,
      mesesDeudaTotal: linea.mesesDeuda,
      textoBusqueda: normalizarTexto([linea.nombre, linea.rut, linea.jugador?.correo_apoderado].join(' ')),
    });
  });

  return filas.sort((a, b) => (b.deudaTotal - a.deudaTotal) || a.nombre.localeCompare(b.nombre, 'es'));
};

// Filtros de la lista "Por cobrar".
export const filtrarCuentasQuePagan = (filas = [], { texto = '', estado = 'con_deuda', perfil = 'todos', rama = 'todas' } = {}) => {
  const q = normalizarTexto(texto.trim());
  return filas.filter((f) => {
    if (estado === 'con_deuda' && f.deudaTotal <= 0) return false;
    if (estado === 'al_dia' && f.deudaTotal > 0) return false;
    if (perfil === 'socios' && !f.esSocio) return false;
    if (perfil === 'apoderados' && !f.esApoderado) return false;
    if (perfil === 'autogestionados' && !f.autogestionado) return false;
    if (perfil === 'sin_responsable' && f.tipo !== 'sin_responsable') return false;
    if (rama !== 'todas' && !f.pupilos.some((p) => p.rama === rama)) return false;
    if (q && !f.textoBusqueda.includes(q)) return false;
    return true;
  });
};

export const resumirCuentasQuePagan = (filas = []) => filas.reduce((acc, f) => {
  acc.total += f.deudaTotal;
  acc.socios += f.socio?.deuda || 0;
  acc.deportistas += f.pupilos.reduce((s, p) => s + p.deuda, 0);
  if (f.deudaTotal > 0) acc.conDeuda += 1;
  return acc;
}, { total: 0, socios: 0, deportistas: 0, conDeuda: 0 });
