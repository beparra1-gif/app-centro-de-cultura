import { useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import { normalizarRol } from '../security/accessControl';

// Alcance de un entrenador (cuentas.categorias_asignadas): cada entrada es
// "RAMA|CATEGORÍA" (ej. "FEMENINA|SUB-13") o, en asignaciones antiguas, solo
// la categoría (cualquier rama). [] = sin restricción. ramas_asignadas es el
// formato anterior y se sigue respetando. Misma regla que el backend
// (backend/lib/alcanceStaff.js).
const low = (v) => String(v ?? '').trim().toLowerCase();
const arr = (v) => (Array.isArray(v) ? v : []);

export const parRamaCategoria = (rama, categoria) => `${String(rama || '').trim().toUpperCase()}|${String(categoria || '').trim()}`;

export const enAlcanceStaff = (cuenta = {}, j = {}) => {
  const entradas = arr(cuenta.categorias_asignadas).map(low).filter(Boolean);
  const ramas = arr(cuenta.ramas_asignadas).map(low).filter(Boolean);
  const cat = low(j.categoria);
  const rama = low(j.rama);
  if (ramas.length && !ramas.includes(rama)) return false;
  if (!entradas.length) return true;
  return entradas.includes(cat) || entradas.includes(`${rama}|${cat}`);
};

// Jugadores que el staff logueado puede ver. Se lee la cuenta propia (no el
// login) para que el cambio del admin aplique sin volver a ingresar.
export function useJugadoresDeCategoriasAsignadas(usuario, jugadores) {
  const [cuenta, setCuenta] = useState({});
  const esStaff = normalizarRol(usuario?.rol) === 'staff';
  const id = usuario?.id;
  const activo = Boolean(esStaff && id);

  useEffect(() => {
    if (!esStaff || !id) return undefined;
    let cancelado = false;
    api.cuentasAPI.getById(id)
      .then((c) => { if (!cancelado) setCuenta(c || {}); })
      .catch(() => { if (!cancelado) setCuenta({}); });
    return () => { cancelado = true; };
  }, [esStaff, id]);

  return useMemo(
    () => (Array.isArray(jugadores) ? jugadores : []).filter((j) => !activo || enAlcanceStaff(cuenta, j)),
    [jugadores, cuenta, activo],
  );
}
