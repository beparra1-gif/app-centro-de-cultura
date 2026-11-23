// Citaciones: resumen de respuestas (una sola fórmula para el Muro y para
// Control de Citaciones), banca de reserva y mensajes de WhatsApp con el
// enlace directo de respuesta.

export const esBanca = (c = {}) => c.rol_convocatoria === 'banca';

// Porcentajes sobre los TITULARES; la banca se informa aparte (no cuenta como
// pendiente ni como inasistente: es reserva).
export const calcularResumenCitacion = (convocados = []) => {
  const titulares = convocados.filter((c) => !esBanca(c));
  const banca = convocados.filter(esBanca);
  const total = titulares.length;
  const confirmados = titulares.filter((c) => c.respuesta === 'si').length;
  const automaticos = titulares.filter((c) => c.respuesta === 'no' && c.respondido_automaticamente).length;
  const justificados = titulares.filter((c) => c.respuesta === 'no' && !c.respondido_automaticamente).length;
  const inasistentes = automaticos + justificados;
  const respondidos = confirmados + inasistentes;
  const pendientes = Math.max(total - respondidos, 0);
  const progreso = total > 0 ? Math.round((respondidos / total) * 100) : 0;
  const aceptadas = total > 0 ? Math.round((confirmados / total) * 100) : 0;
  return {
    total, confirmados, inasistentes, justificados, automaticos, pendientes, progreso, aceptadas,
    banca: banca.length,
    bancaDisponible: banca.filter((c) => c.respuesta !== 'no').length,
  };
};

// El propio deportista solo responde si el club lo marcó autogestionable
// (el backend lo informa por convocado); los demás solo ven que fueron
// citados y responde su apoderado.
export const puedeJugadorResponderPropiaCitacion = (convocado = {}) => Boolean(convocado.autogestionado);

// Enlace directo para responder sin iniciar sesión (token único por citado).
export const urlRespuestaCitacion = (token) => `${window.location.origin}/?citacion=${encodeURIComponent(token)}`;

const fechaLegible = (iso) => {
  const [a, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!a) return '';
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${dias[new Date(a, m - 1, d).getDay()]} ${d} de ${meses[m - 1]}`;
};
const hora = (h) => String(h || '').slice(0, 5);
const lineaHorario = (cita) => `📅 ${fechaLegible(cita.dia_citacion)} · Citación (llegada) ${hora(cita.hora_presentacion)} · Partido ${hora(cita.hora_citacion)}`;
// Dirección + enlace de Google Maps (en WhatsApp abre la app de mapas o Waze).
const lineasLugar = (cita) => {
  const q = [cita.lugar_nombre, cita.lugar_direccion].filter(Boolean).join(', ');
  return q ? [`📍 ${q}`, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`] : [];
};
const plazoLegible = (fechaHora) => {
  if (!fechaHora) return '';
  const [fecha, hh] = String(fechaHora).split('T');
  return `${fechaLegible(fecha)} a las ${hora(hh)}`;
};

// Mensaje personal al apoderado (o al deportista autogestionado) con su enlace.
export const mensajeWhatsappCitacion = (cita = {}, convocado = {}) => {
  const saludo = convocado.apoderado_nombre ? `Hola ${String(convocado.apoderado_nombre).split(' ')[0]}` : 'Hola';
  const partido = `${cita.tipo_competencia || ''} ${cita.competencia_nombre || ''} vs ${cita.rival_nombre || ''}`.replace(/\s+/g, ' ').trim();
  const lineas = esBanca(convocado)
    ? [`${saludo}! ${convocado.nombre} quedó en la *banca (reserva)* para ${partido}.`]
    : [`${saludo}! ${convocado.nombre} fue *citada/o* a ${partido}.`];
  lineas.push(
    lineaHorario(cita),
    ...lineasLugar(cita),
    ...(cita.mensaje_adicional ? ['', `📝 ${cita.mensaje_adicional}`] : []),
    '',
    esBanca(convocado)
      ? 'Si se libera un cupo te avisaremos. Puedes indicar desde ya si estará disponible:'
      : 'Confirma la asistencia o indica el motivo si no puede ir:',
    urlRespuestaCitacion(convocado.token_respuesta),
  );
  if (cita.hora_maxima_confirmacion && !esBanca(convocado)) lineas.push('', `⏰ Plazo para responder: ${plazoLegible(cita.hora_maxima_confirmacion)}.`);
  lineas.push('', 'Centro de Cultura Física Viña del Mar');
  return lineas.join('\n');
};

// Mensaje para el grupo de WhatsApp de la categoría: nómina sin enlaces
// personales (cada familia responde con su enlace o en la app).
export const mensajeGrupoCitacion = (cita = {}) => {
  const convocados = cita.convocados || [];
  const titulares = convocados.filter((c) => !esBanca(c)).map((c, i) => `${i + 1}. ${c.nombre}`);
  const banca = convocados.filter(esBanca).map((c) => `• ${c.nombre}`);
  const partido = `${cita.tipo_competencia || ''} ${cita.competencia_nombre || ''} vs ${cita.rival_nombre || ''}`.replace(/\s+/g, ' ').trim();
  return [
    `📣 *Citación ${partido}*`,
    lineaHorario(cita),
    ...lineasLugar(cita),
    ...(cita.mensaje_adicional ? ['', `📝 ${cita.mensaje_adicional}`] : []),
    '',
    '*Citadas/os:*',
    ...titulares,
    ...(banca.length ? ['', '*En banca (reserva):*', ...banca] : []),
    '',
    'Cada apoderado recibirá su enlace para confirmar, o puede responder en la app (Muro).',
    ...(cita.hora_maxima_confirmacion ? [`⏰ Plazo: ${plazoLegible(cita.hora_maxima_confirmacion)}.`] : []),
  ].join('\n');
};
