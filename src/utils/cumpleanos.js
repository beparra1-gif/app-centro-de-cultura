// Cumpleaños del mes de deportistas y cuentas activas, ordenados por día.
// Las fechas DATE se leen con partesFechaCalendario (en producción llegan
// con hora UTC y new Date() daría el día anterior).
import { partesFechaCalendario } from './fechas';
import { estaActivo } from './estadoActivo';

export const cumpleanosDelMes = ({ jugadores = [], cuentas = [], hoy = new Date() } = {}) => {
  const mes = hoy.getMonth() + 1;
  const vistos = new Set();
  const lista = [];
  const agregar = (persona, tipo, rut) => {
    const p = partesFechaCalendario(persona.fecha_nacimiento);
    const clave = String(rut || '').replace(/[.\s-]/g, '').toUpperCase();
    if (!p || p.mes !== mes || !clave || vistos.has(clave) || !estaActivo(persona)) return;
    vistos.add(clave);
    lista.push({
      clave,
      tipo,
      nombre: `${persona.nombres || ''} ${persona.apellido_paterno || ''}`.trim() || rut,
      dia: p.dia,
      cumple: hoy.getFullYear() - p.anio,
      detalle: tipo === 'jugador' ? (persona.categoria || '') : 'Socio/apoderado',
    });
  };
  jugadores.forEach((j) => agregar(j, 'jugador', j.rut_jugador));
  cuentas.forEach((c) => agregar(c, 'cuenta', c.rut));
  return lista.sort((a, b) => a.dia - b.dia || a.nombre.localeCompare(b.nombre, 'es'));
};
