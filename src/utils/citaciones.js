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
