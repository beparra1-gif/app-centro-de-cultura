import { useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import { normalizarRol } from '../security/accessControl';
import { coincideAlguna } from './texto';

// Categorías a cargo del staff logueado ([] = todas). Se leen de la cuenta
// propia (no del login) para que el cambio del admin aplique sin re-ingresar.
export function useJugadoresDeCategoriasAsignadas(usuario, jugadores) {
  const [leidas, setLeidas] = useState([]);
  const esStaff = normalizarRol(usuario?.rol) === 'staff';
  const id = usuario?.id;
  const activo = Boolean(esStaff && id);

  useEffect(() => {
    if (!esStaff || !id) return undefined;
    let cancelado = false;
    api.cuentasAPI.getById(id)
      .then((c) => { if (!cancelado) setLeidas(Array.isArray(c?.categorias_asignadas) ? c.categorias_asignadas : []); })
      .catch(() => { if (!cancelado) setLeidas([]); });
    return () => { cancelado = true; };
  }, [esStaff, id]);

  return useMemo(
    () => (Array.isArray(jugadores) ? jugadores : []).filter((j) => !activo || coincideAlguna(leidas, j.categoria)),
    [jugadores, leidas, activo],
  );
}
