// Usuarios y Cuentas → "Importar jugadores" (solo super admin): filas pegadas
// desde una planilla (formulario "Datos jugadores": Nombre, RUT, Fecha de
// nacimiento, Fecha de ingreso, Nombre apoderado, RUT apoderado). Arma el
// plan sin tocar la base: deportistas que se crean, fichas que se completan
// (solo campos vacíos), apoderados (uno por RUT aunque se repita) que se
// crean o se reutilizan, y filas omitidas.

const { rutValido, normalizarRut, dividirNombre } = require('./importarPagosPlanilla');
const { categoriaPorNacimiento } = require('./categoriaPorEdad');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const formatearRut = (rut = '') => { const l = normalizarRut(rut); return l ? `${l.slice(0, -1)}-${l.slice(-1)}` : ''; };
const iso = (a, m, d = 1) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fechaValida = (a, m, d) => {
  const f = new Date(Date.UTC(a, m - 1, d));
  return a >= 1940 && a <= 2100 && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};
const mesDeTexto = (t) => { const i = MESES.indexOf(String(t).slice(0, 3)); return i >= 0 ? i + 1 : null; };

// Número de serie de Excel (días desde 1899-12-30) → { a, m, d }.
const desdeSerial = (n) => {
  const f = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return { a: f.getUTCFullYear(), m: f.getUTCMonth() + 1, d: f.getUTCDate() };
};

// "21/06/2011", "05-11-2011", "16.07.2011", "6/7/2012", "11 octubre 2012",
// "05 de Noviembre de 2013", "29 - marzo - 2011", "2012-03-12", 44197 (serial).
const partesFecha = (texto = '') => {
  const t = sinTildes(texto).replace(/\s*([/.-])\s*/g, '$1').replace(/\bde(l)?\b/g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { a: +m[1], m: +m[2], d: +m[3] };
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return { a: +m[3], m: +m[2], d: +m[1] };
  m = t.match(/^(\d{1,2})[ /.-]([a-z]+)[ /.-](\d{4})$/);
  if (m && mesDeTexto(m[2])) return { a: +m[3], m: mesDeTexto(m[2]), d: +m[1] };
  if (/^\d{5}$/.test(t)) return desdeSerial(Number(t));
  return null;
};

const parsearNacimiento = (texto) => {
  const p = partesFecha(texto);
  return p && fechaValida(p.a, p.m, p.d) ? iso(p.a, p.m, p.d) : null;
};

// Ingreso al club → primer día del mes: fechas completas, "Mayo 2025",
// "Marzo, 2026", "Febrero de 2026", "2do semestre 2022" (julio), "2024" (enero).
const parsearIngreso = (texto) => {
  const p = partesFecha(texto);
  if (p && fechaValida(p.a, p.m, p.d)) return iso(p.a, p.m);
  const t = sinTildes(texto).replace(/\bde(l)?\b|,/g, ' ').replace(/\s+/g, ' ').trim();
  const anio = Number((t.match(/\b(19|20)\d{2}\b/) || [])[0]);
  if (!anio) return null;
  if (/semestre/.test(t)) return iso(anio, /\b(2|2do|segundo)\s*semestre/.test(t) ? 7 : 1); // antes que "sem" → sep
  const palabra = (t.match(/[a-z]{3,}/) || [])[0];
  if (palabra && mesDeTexto(palabra)) return iso(anio, mesDeTexto(palabra));
  return /^\d{4}$/.test(t) ? iso(anio, 1) : null;
};

const esPlaceholder = (correo) => /@actualizar\.local$/i.test(String(correo || ''));
const nombreCompleto = (j) => [j.nombres, j.apellido_paterno, j.apellido_materno].filter(Boolean).join(' ');

const planificarImportacionJugadores = ({ texto = '', jugadores = [], cuentas = [], rama = null, hoy = new Date() } = {}) => {
  const filas = String(texto || '').split(/\r?\n/).map((l) => l.split('\t').map((c) => c.trim()));
  const jugadorPorRut = new Map(jugadores.map((j) => [normalizarRut(j.rut_jugador), j]));
  const cuentaPorRut = new Map(cuentas.map((c) => [normalizarRut(c.rut), c]));
  const crear = [];
  const completar = [];
  const yaEstaban = [];
  const omitidos = [];
  const conflictos = [];
  const apoderados = new Map(); // rut normalizado → { rut, nombre, variantes, cuenta, hijos }
  const vistos = new Set();

  filas.forEach((c, i) => {
    const fila = i + 1;
    if (!c.some(Boolean)) return;
    if (i === 0 && /nombre/i.test(c[0]) && /rut/i.test(c[1] || '')) return; // encabezado
    const [nombre, rutTexto, nacTexto, ingTexto, nombreApo, rutApoTexto] = c;
    const rut = normalizarRut(rutTexto);
    if (!nombre) { omitidos.push({ fila, nombre: '', rut: rutTexto, motivo: 'sin nombre' }); return; }
    if (!rutValido(rut)) { omitidos.push({ fila, nombre, rut: rutTexto, motivo: 'RUT del jugador inválido' }); return; }
    if (vistos.has(rut)) { omitidos.push({ fila, nombre, rut: formatearRut(rut), motivo: 'RUT repetido en la planilla' }); return; }
    vistos.add(rut);

    const fecha_nacimiento = parsearNacimiento(nacTexto);
    const fecha_ingreso = parsearIngreso(ingTexto);
    const avisos = [];
    if (nacTexto && !fecha_nacimiento) avisos.push(`fecha de nacimiento no reconocida ("${nacTexto}")`);
    if (ingTexto && !fecha_ingreso) avisos.push(`fecha de ingreso no reconocida ("${ingTexto}")`);

    // Apoderado: uno por RUT (hermanos comparten la misma cuenta).
    const rutApo = normalizarRut(rutApoTexto);
    let apoderado = null;
    if (rutApo && rutApo === rut) avisos.push('el RUT del apoderado es el mismo del jugador');
    else if (rutApo && !rutValido(rutApo)) avisos.push(`RUT del apoderado inválido ("${rutApoTexto}")`);
    else if (rutApo) {
      if (!apoderados.has(rutApo)) {
        apoderados.set(rutApo, { rut: formatearRut(rutApo), nombre: nombreApo || '', variantes: new Set(), cuenta: cuentaPorRut.get(rutApo) || null, hijos: [] });
      }
      apoderado = apoderados.get(rutApo);
      if (nombreApo) apoderado.variantes.add(nombreApo);
      if (!apoderado.nombre && nombreApo) apoderado.nombre = nombreApo;
      apoderado.hijos.push(nombre);
    }
    const rut_apoderado = apoderado ? (apoderado.cuenta?.rut || apoderado.rut) : null;
    const correoCuenta = apoderado?.cuenta?.correo;
    const correo_apoderado = correoCuenta && !esPlaceholder(correoCuenta) ? correoCuenta : null;

    const existente = jugadorPorRut.get(rut);
    if (!existente) {
      crear.push({
        fila,
        nombre,
        avisos,
        apoderado: apoderado?.nombre || null,
        ficha: {
          rut_jugador: formatearRut(rut),
          ...dividirNombre(nombre),
          fecha_nacimiento,
          fecha_ingreso,
          rama: rama || null,
          categoria: categoriaPorNacimiento(fecha_nacimiento, hoy.getFullYear()),
          rut_apoderado,
          correo_apoderado,
        },
      });
      return;
    }

    // Ya existe: solo se completan campos vacíos; nada se sobrescribe.
    const cambios = {};
    if (!existente.fecha_nacimiento && fecha_nacimiento) cambios.fecha_nacimiento = fecha_nacimiento;
    if (!existente.fecha_ingreso && fecha_ingreso) cambios.fecha_ingreso = fecha_ingreso;
    if (rut_apoderado) {
      const actual = normalizarRut(existente.rut_apoderado);
      if (!actual) {
        cambios.rut_apoderado = rut_apoderado;
        if (correo_apoderado && !String(existente.correo_apoderado || '').trim()) cambios.correo_apoderado = correo_apoderado;
      } else if (actual !== normalizarRut(rut_apoderado)) {
        conflictos.push({ fila, nombre: nombreCompleto(existente) || nombre, rut: existente.rut_jugador, actual: existente.rut_apoderado, planilla: rut_apoderado });
      }
    }
    const item = { fila, nombre: nombreCompleto(existente) || nombre, rut: existente.rut_jugador, avisos };
    if (Object.keys(cambios).length) completar.push({ ...item, cambios });
    else yaEstaban.push(item);
  });

  const listaApoderados = [...apoderados.values()].map((a) => ({
    rut: a.rut,
    nombre: a.cuenta ? nombreCompleto(a.cuenta) || a.nombre : a.nombre,
    existe: Boolean(a.cuenta),
    variantes: [...a.variantes],
    hijos: a.hijos,
    cuenta: a.cuenta ? null : { rut: a.rut, ...dividirNombre(a.nombre) },
  }));
  const crearApoderados = listaApoderados.filter((a) => !a.existe);

  return {
    crear,
    completar,
    yaEstaban,
    omitidos,
    conflictos,
    apoderados: listaApoderados,
    resumen: {
      crear: crear.length,
      completar: completar.length,
      yaEstaban: yaEstaban.length,
      omitidos: omitidos.length,
      conflictos: conflictos.length,
      apoderados: listaApoderados.length,
      crearApoderados: crearApoderados.length,
    },
  };
};

module.exports = { planificarImportacionJugadores, parsearNacimiento, parsearIngreso };
