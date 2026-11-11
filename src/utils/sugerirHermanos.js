// Posibles hermanos que todavía no están unidos como familia (ni por
// apoderado ni por grupo_familiar). Pistas:
//  - mismos dos apellidos (paterno y materno)
//  - mismo teléfono de emergencia
//  - mismo contacto de emergencia (nombre) y un apellido en común
// El admin confirma con "Unir como hermanos" (Usuarios y Cuentas →
// Vincular apoderados); nada se une solo.

import { agruparFamilias } from './hermanos';
import { estaActivo } from './estadoActivo';

const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const digitos = (t = '') => String(t || '').replace(/\D/g, '').slice(-8);
const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();

export const sugerirHermanos = (jugadoresTodos = []) => {
  const jugadores = (jugadoresTodos || []).filter((j) => norm(j.rut_jugador) && estaActivo(j));
  const familia = agruparFamilias(jugadores);
  const famDe = (j) => familia.get(norm(j.rut_jugador));

  // Union-find de las pistas, con los motivos acumulados por grupo.
  const padre = new Map(jugadores.map((j) => [norm(j.rut_jugador), norm(j.rut_jugador)]));
  const raiz = (x) => { while (padre.get(x) !== x) x = padre.get(x); return x; };
  const motivos = new Map();
  const unir = (a, b, motivo) => {
    if (famDe(a) === famDe(b)) return; // ya son familia
    const ra = raiz(norm(a.rut_jugador));
    const rb = raiz(norm(b.rut_jugador));
    if (ra !== rb) padre.set(rb, ra);
    const r = raiz(ra);
    const lista = new Set([...(motivos.get(ra) || []), ...(motivos.get(rb) || []), ...(motivos.get(r) || []), motivo]);
    motivos.set(r, lista);
  };

  const porClave = (clave, motivo) => {
    const grupos = new Map();
    jugadores.forEach((j) => {
      const k = clave(j);
      if (!k) return;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(j);
    });
    grupos.forEach((lista) => {
      if (lista.length < 2 || lista.length > 6) return; // >6 = dato genérico, no una familia
      for (let i = 1; i < lista.length; i += 1) unir(lista[0], lista[i], motivo(lista[0]));
    });
  };

  porClave(
    (j) => (sinTildes(j.apellido_paterno) && sinTildes(j.apellido_materno) ? `${sinTildes(j.apellido_paterno)}|${sinTildes(j.apellido_materno)}` : ''),
    (j) => `mismos apellidos (${j.apellido_paterno} ${j.apellido_materno})`
  );
  porClave(
    (j) => (digitos(j.num_emergencia).length === 8 ? digitos(j.num_emergencia) : ''),
    () => 'mismo teléfono de emergencia'
  );
  porClave(
    (j) => {
      const contacto = sinTildes(j.nombre_emergencia);
      return contacto && contacto.split(' ').length >= 2 ? contacto : '';
    },
    (j) => `mismo contacto de emergencia (${j.nombre_emergencia})`
  );

  const grupos = new Map();
  jugadores.forEach((j) => {
    const r = raiz(norm(j.rut_jugador));
    if (!motivos.has(r)) return;
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(j);
  });
  return [...grupos.entries()]
    .filter(([, lista]) => lista.length > 1)
    .map(([r, lista]) => ({
      clave: r,
      jugadores: lista.sort((a, b) => String(a.fecha_nacimiento || '').localeCompare(String(b.fecha_nacimiento || ''))),
      motivos: [...motivos.get(r)],
      // Dos pistas distintas (ej. apellidos + teléfono) = muy probable.
      segura: motivos.get(r).size >= 2,
    }))
    .sort((a, b) => Number(b.segura) - Number(a.segura) || String(a.jugadores[0].apellido_paterno || '').localeCompare(String(b.jugadores[0].apellido_paterno || ''), 'es'));
};
