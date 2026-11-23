// Citaciones: resumen de respuestas (una sola fórmula para el Muro y para
// Control de Citaciones), banca de reserva y mensajes de WhatsApp con el
// enlace directo de respuesta.

// El propio deportista solo responde si el club lo marcó autogestionable
// (el backend lo informa por convocado); los demás solo ven que fueron citados.
export const puedeJugadorResponderPropiaCitacion = (convocado = {}) => Boolean(convocado.autogestionado);

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

// Enlace de la citación para el WhatsApp del grupo: abre la app (pide iniciar
// sesión) y muestra la citación solo a quien está en la nómina o la gestiona.
export const urlCitacionGrupal = (token) => `${window.location.origin}/?partido=${encodeURIComponent(token)}`;

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
// "Sábado 21" (como lo escribe el club en sus citaciones).
const diaCorto = (iso) => {
  const [a, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  return a ? `${DIAS[new Date(a, m - 1, d).getDay()]} ${d}` : '';
};
const hora = (h) => String(h || '').slice(0, 5);
// SUB-15 → U-15 (forma en que el club nombra la categoría en WhatsApp).
const categoriaCorta = (c) => String(c || '').trim().replace(/^sub[-\s]?/i, 'U-');
const tituloNomina = (rama) => {
  const r = String(rama || '').toLowerCase();
  if (r.startsWith('fem')) return 'JUGADORAS CITADAS';
  if (r.startsWith('masc')) return 'JUGADORES CITADOS';
  return 'DEPORTISTAS CITADOS';
};

// Encabezado común: sin enlaces de mapa (la ubicación con Maps/Waze está en la app).
const encabezado = (cita) => {
  const categoria = cita.categoria_base && cita.categoria_base !== 'todas' ? ` ${categoriaCorta(cita.categoria_base)}` : '';
  return [
    `⚪️🔵 CITACIÓN OFICIAL${categoria} ⚪️🔵`,
    '',
    `🏆 Competencia: ${cita.competencia_nombre || ''}`,
    `📅 Día: ${diaCorto(cita.dia_citacion)}`,
    ...(cita.lugar_nombre ? [`📍 Lugar: ${cita.lugar_nombre}`] : []),
    `⏰ Hora : ${hora(cita.hora_citacion)}`,
    `🕙 Hora de llegada: ${hora(cita.hora_presentacion)}`,
  ];
};

// Mensaje del grupo de WhatsApp: nómina y UN enlace para que cualquiera de los citados confirme.
export const mensajeGrupoCitacion = (cita = {}) => {
  const convocados = cita.convocados || [];
  const titulares = convocados.filter((c) => !esBanca(c)).map((c) => `• ${c.nombre}`);
  const banca = convocados.filter(esBanca).map((c) => `• ${c.nombre}`);
  return [
    ...encabezado(cita),
    ...(cita.mensaje_adicional ? ['', `📝 ${cita.mensaje_adicional}`] : []),
    '',
    `👥 ${tituloNomina(cita.rama)}`,
    '',
    ...titulares,
    ...(banca.length ? ['', '🔁 EN BANCA (reserva)', '', ...banca] : []),
    '',
    'Acá enlace para confirmar citación',
    urlCitacionGrupal(cita.token_publico),
  ].join('\n');
};

// Recordatorio personal (a quien aún no responde), con el mismo enlace único.
export const mensajeWhatsappCitacion = (cita = {}, convocado = {}) => {
  const saludo = convocado.apoderado_nombre ? `Hola ${String(convocado.apoderado_nombre).split(' ')[0]}` : 'Hola';
  return [
    ...encabezado(cita),
    '',
    esBanca(convocado)
      ? `${saludo}, ${convocado.nombre} quedó en la banca (reserva) para este partido.`
      : `${saludo}, ${convocado.nombre} está citada/o. Por favor confirma la asistencia o indica el motivo si no puede ir.`,
    '',
    'Acá enlace para confirmar citación',
    urlCitacionGrupal(cita.token_publico),
  ].join('\n');
};
