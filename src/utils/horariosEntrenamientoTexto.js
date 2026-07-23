const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Describe el patrón de recurrencia de un horario para mostrarlo en listas y
// selects — compartido entre el formulario de horarios y el de excepciones.
export const describirRecurrencia = (h) => {
  if (h.tipo_recurrencia === 'mensual') {
    const dias = Array.isArray(h.dias_mes) ? h.dias_mes : [];
    return dias.length ? `Día${dias.length > 1 ? 's' : ''} ${dias.join(', ')} de cada mes` : 'Mensual';
  }
  const dias = Array.isArray(h.dias_semana) ? h.dias_semana : [];
  return dias.length ? dias.map((d) => DIAS_SEMANA_CORTO[d]).join(', ') : 'Semanal';
};

export const describirVigencia = (h) => {
  const ini = h.fecha_inicio ? String(h.fecha_inicio).slice(0, 10) : null;
  const fin = h.fecha_fin ? String(h.fecha_fin).slice(0, 10) : null;
  if (ini && fin) return `Vigente ${ini} a ${fin}`;
  if (ini) return `Vigente desde ${ini}`;
  if (fin) return `Vigente hasta ${fin}`;
  return '';
};
