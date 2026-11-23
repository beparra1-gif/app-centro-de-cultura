// Alcance de un entrenador (cuentas.categorias_asignadas): cada entrada es
// "RAMA|CATEGORÍA" (ej. "FEMENINA|SUB-13") o, en asignaciones antiguas, solo
// la categoría (cualquier rama). [] = sin restricción. ramas_asignadas es el
// formato anterior (rama para todas las categorías) y se sigue respetando.
// Misma regla en el frontend: src/utils/categoriasStaff.js.

const low = (v) => String(v ?? '').trim().toLowerCase();
const arr = (v) => (Array.isArray(v) ? v : []);

const leerAlcance = (cuenta = {}) => {
  const entradas = arr(cuenta.categorias_asignadas).map(low).filter(Boolean);
  return {
    pares: entradas.filter((e) => e.includes('|')),
    solas: entradas.filter((e) => !e.includes('|')),
    ramas: arr(cuenta.ramas_asignadas).map(low).filter(Boolean),
    // Solo las categorías (sin rama), para filtros gruesos (Academia, ranking).
    categorias: [...new Set(entradas.map((e) => e.split('|').pop()))],
  };
};

const sinRestriccion = (a) => !a.pares.length && !a.solas.length && !a.ramas.length;

const enAlcance = (a, j = {}) => {
  const cat = low(j.categoria);
  const rama = low(j.rama);
  if (a.ramas.length && !a.ramas.includes(rama)) return false;
  if (!a.pares.length && !a.solas.length) return true;
  return a.solas.includes(cat) || a.pares.includes(`${rama}|${cat}`);
};

module.exports = { leerAlcance, sinRestriccion, enAlcance };
