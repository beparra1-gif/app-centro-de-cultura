// Resumen de respuestas de una citación, usado tanto por el muro (apoderado)
// como por Control de Citaciones (profesor/admin) — una sola fórmula para
// que ambas vistas siempre muestren los mismos números.
export const calcularResumenCitacion = (convocados = []) => {
  const total = convocados.length;
  const confirmados = convocados.filter((c) => c.respuesta === 'si').length;
  const automaticos = convocados.filter((c) => c.respuesta === 'no' && c.respondido_automaticamente).length;
  const justificados = convocados.filter((c) => c.respuesta === 'no' && !c.respondido_automaticamente).length;
  const inasistentes = automaticos + justificados;
  const respondidos = confirmados + inasistentes;
  const pendientes = Math.max(total - respondidos, 0);
  const progreso = total > 0 ? Math.round((respondidos / total) * 100) : 0;
  return { total, confirmados, inasistentes, justificados, automaticos, pendientes, progreso };
};

// Edad en años cumplidos desde una fecha de nacimiento. Null si no hay fecha
// válida — mismo criterio que calcularEdad en backend/security/auth.js (no
// se puede compartir el archivo entre frontend ESM y backend CommonJS, pero
// la fórmula se mantiene igual a propósito).
export const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const aunNoCumpleEsteAnio = (
    hoy.getUTCMonth() < nacimiento.getUTCMonth()
    || (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() < nacimiento.getUTCDate())
  );
  if (aunNoCumpleEsteAnio) edad -= 1;
  return edad;
};

export const EDAD_MINIMA_RESPUESTA_PROPIA = 13;

// Puede el propio deportista responder su citación (además del apoderado,
// que siempre puede) — regla de negocio: bajo esta edad, solo responde el
// apoderado; sin fecha de nacimiento cargada, nunca se asume que sí puede.
export const puedeJugadorResponderPropiaCitacion = (convocado = {}) => {
  const edad = calcularEdad(convocado.fecha_nacimiento);
  return edad !== null && edad >= EDAD_MINIMA_RESPUESTA_PROPIA;
};
