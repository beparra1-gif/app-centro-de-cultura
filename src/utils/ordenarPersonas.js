// Orden de listas de personas (informes de deuda, Tesorería, Usuarios y
// Cuentas). Cada lista entrega un `acceso(item)` que devuelve los datos
// comparables; los vacíos (sin fecha, sin categoría…) van siempre al final,
// sea cual sea la dirección.

import { ordenarCategorias } from './informeDeuda';

export const OPCIONES_ORDEN = [
  { id: 'deuda', label: 'Deuda', asc: 'Menor deuda primero', desc: 'Mayor deuda primero', dirInicial: 'desc' },
  { id: 'apellido', label: 'Apellido', asc: 'A → Z', desc: 'Z → A', dirInicial: 'asc' },
  { id: 'nombre', label: 'Nombre', asc: 'A → Z', desc: 'Z → A', dirInicial: 'asc' },
  { id: 'nacimiento', label: 'Fecha de nacimiento', asc: 'Más antigua primero', desc: 'Más reciente primero', dirInicial: 'asc' },
  { id: 'edad', label: 'Edad', asc: 'Menor edad primero', desc: 'Mayor edad primero', dirInicial: 'asc' },
  { id: 'categoria', label: 'Categoría', asc: 'Menor categoría primero', desc: 'Mayor categoría primero', dirInicial: 'asc' },
];

const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const fechaISO = (v) => {
  const t = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
};
const vacio = (v) => v === '' || v === null || v === undefined;

// acceso(item) → { nombre, apellido, fechaNacimiento, categoria, deuda }
const comparadorBase = (orden, a, b) => {
  switch (orden) {
    case 'apellido': return sinTildes(a.apellido).localeCompare(sinTildes(b.apellido), 'es');
    case 'nombre': return sinTildes(a.nombre).localeCompare(sinTildes(b.nombre), 'es');
    // Fecha más antigua = mayor edad: "edad" es la fecha al revés.
    case 'nacimiento': return fechaISO(a.fechaNacimiento).localeCompare(fechaISO(b.fechaNacimiento));
    case 'edad': return fechaISO(b.fechaNacimiento).localeCompare(fechaISO(a.fechaNacimiento));
    case 'categoria': return ordenarCategorias(a.categoria, b.categoria);
    case 'deuda': default: return (Number(a.deuda) || 0) - (Number(b.deuda) || 0);
  }
};

const valorClave = (orden, d) => {
  if (orden === 'apellido') return sinTildes(d.apellido);
  if (orden === 'nombre') return sinTildes(d.nombre);
  if (orden === 'nacimiento' || orden === 'edad') return fechaISO(d.fechaNacimiento);
  if (orden === 'categoria') return /sin categor/i.test(String(d.categoria || '')) ? '' : String(d.categoria || '').trim();
  return 0;
};

export const ordenarPersonas = (lista = [], { orden = 'deuda', dir = 'desc' } = {}, acceso = (x) => x) => {
  const signo = dir === 'desc' ? -1 : 1;
  return [...lista]
    .map((item) => ({ item, d: acceso(item) || {} }))
    .sort((x, y) => {
      const vx = vacio(valorClave(orden, x.d));
      const vy = vacio(valorClave(orden, y.d));
      if (vx !== vy) return vx ? 1 : -1;
      return (signo * comparadorBase(orden, x.d, y.d))
        // Desempate estable y legible: apellido y nombre.
        || sinTildes(`${x.d.apellido} ${x.d.nombre}`).localeCompare(sinTildes(`${y.d.apellido} ${y.d.nombre}`), 'es');
    })
    .map(({ item }) => item);
};

export const dirInicialDe = (orden) => OPCIONES_ORDEN.find((o) => o.id === orden)?.dirInicial || 'asc';
