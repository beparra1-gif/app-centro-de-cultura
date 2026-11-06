// Notificaciones in-app y destinatarios de citaciones/RSVP; barrido de citaciones vencidas.
// Extraído de server.js sin cambios de comportamiento.
const { normalizarRutParaComparar } = require('../security/auth');
const { pool } = require('./db');

// ==========================================
// 11B. ENDPOINTS: CITACIONES (persistencia real + RSVP + notificaciones)
// ==========================================

// pg devuelve las columnas DATE como objetos Date; interpolarlas directo en un
// template literal cae en Date.toString() (verboso, con huso horario). Esto
// las deja en YYYY-MM-DD para el cuerpo de la notificación.
const formatearFechaCitacion = (valor) => {
  if (!valor) return 'por confirmar';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return fecha.toISOString().slice(0, 10);
};

// Crea una fila de notificación in-app para un RUT destinatario. No lanza:
// una notificación fallida no debe tumbar la creación/RSVP de la citación.
const crearNotificacionApp = async ({ rut, tipo, titulo, cuerpo, referenciaTipo, referenciaId }) => {
  const rutLimpio = String(rut || '').trim();
  if (!rutLimpio) return;
  try {
    await pool.query(
      `INSERT INTO notificaciones_app (rut_destinatario, tipo, titulo, cuerpo, referencia_tipo, referencia_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [rutLimpio, tipo, titulo, cuerpo, referenciaTipo, referenciaId]
    );
  } catch (err) {
    console.error('❌ Error creando notificación in-app:', err.message);
  }
};

// Resuelve los RUT a notificar por cada convocado: el apoderado registrado
// (por rut_apoderado, con correo_apoderado como respaldo) y la cuenta propia
// del jugador si inició sesión alguna vez con su propio RUT.
const resolverDestinatariosCitacion = async (convocados) => {
  const ruts = new Set();
  for (const conv of convocados) {
    const rutJugador = String(conv.rut_jugador || '').trim();
    if (!rutJugador) continue;

    const jugadorRow = await pool.query(
      'SELECT rut_apoderado, correo_apoderado FROM jugadores WHERE rut_jugador = $1',
      [rutJugador]
    );
    const rutApoderado = String(jugadorRow.rows[0]?.rut_apoderado || '').trim();
    const correoApoderado = String(jugadorRow.rows[0]?.correo_apoderado || conv.correo_apoderado || '').trim();

    if (rutApoderado) {
      ruts.add(normalizarRutParaComparar(rutApoderado));
    } else if (correoApoderado) {
      const cuentaPorCorreo = await pool.query('SELECT rut FROM cuentas WHERE LOWER(correo) = LOWER($1)', [correoApoderado]);
      if (cuentaPorCorreo.rows[0]?.rut) ruts.add(normalizarRutParaComparar(cuentaPorCorreo.rows[0].rut));
    }

    const cuentaJugador = await pool.query(
      "SELECT rut FROM cuentas WHERE REPLACE(REPLACE(UPPER(rut), '.', ''), '-', '') = $1",
      [normalizarRutParaComparar(rutJugador)]
    );
    if (cuentaJugador.rows[0]?.rut) ruts.add(normalizarRutParaComparar(cuentaJugador.rows[0].rut));
  }
  return ruts;
};

// Destinatarios de un evento de RSVP (confirmación/rechazo, manual o
// automático por vencimiento de plazo): el responsable de la citación
// (quien la creó) más toda cuenta admin/super_admin, para que el club
// siempre se entere aunque no haya sido ese admin quien la creó.
const resolverDestinatariosRSVP = async (responsableRut) => {
  const ruts = new Set();
  if (responsableRut) ruts.add(normalizarRutParaComparar(responsableRut));
  const admins = await pool.query("SELECT rut FROM cuentas WHERE LOWER(rol) IN ('admin', 'super_admin', 'superadmin')");
  admins.rows.forEach((row) => { if (row.rut) ruts.add(normalizarRutParaComparar(row.rut)); });
  return ruts;
};

// citacion_convocados ya guardaba estado_excepcion='solicitada' al convocar
// a un moroso (columna que existía desde antes), pero nadie se enteraba: no
// se avisaba a admin/super_admin ni había forma de resolverlo, así que
// quedaba en 'solicitada' para siempre sin bloquear ni aprobar nada de
// verdad. Esto notifica esa solicitud pendiente; el endpoint
// POST /api/citaciones/:id/convocados/:rut/resolver-excepcion (admin/super_admin
// only) es lo que ahora sí puede resolverla.
const notificarExcepcionMorosidadPendiente = async (morosos, citacion, responsableNombre) => {
  if (!Array.isArray(morosos) || morosos.length === 0) return;
  try {
    const adminsRes = await pool.query("SELECT rut FROM cuentas WHERE LOWER(rol) IN ('admin', 'super_admin', 'superadmin')");
    if (adminsRes.rows.length === 0) return;
    const nombresMorosos = morosos.map((m) => m.nombre || m.rut_jugador).filter(Boolean).join(', ');
    const titulo = `Autorización pendiente: ${morosos.length} deportista${morosos.length > 1 ? 's' : ''} con deuda`;
    const cuerpo = `${responsableNombre || 'Un integrante del staff'} citó a ${nombresMorosos} (mensualidad pendiente) para ${citacion.tipo_competencia || ''} ${citacion.competencia_nombre} vs ${citacion.rival_nombre}. Requiere tu autorización.`.trim();
    await Promise.all(adminsRes.rows.map((row) => crearNotificacionApp({
      rut: row.rut, tipo: 'citacion_excepcion_pendiente', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: citacion.id,
    })));
  } catch (err) {
    console.error('[notificarExcepcionMorosidadPendiente]', err.message);
  }
};

// Barrido idempotente: cualquier convocado 'pendiente' cuya citación ya pasó
// su hora_maxima_confirmacion se marca 'no' automáticamente (sin
// justificación, respondido_automaticamente=true). Se puede correr tantas
// veces como se quiera: una segunda corrida no vuelve a tocar filas que ya
// dejaron de estar 'pendiente'. Se llama desde un cron (cada 5 min) y además
// al inicio de los GET de citaciones, para que la vista se vea correcta al
// instante aunque el cron no haya corrido todavía.
const barrerCitacionesVencidas = async () => {
  const result = await pool.query(`
    UPDATE citacion_convocados cc
    SET respuesta = 'no', respondido_automaticamente = true, actualizado_en = NOW()
    FROM citaciones c
    WHERE cc.citacion_id = c.id
      AND cc.respuesta = 'pendiente'
      AND c.hora_maxima_confirmacion IS NOT NULL
      AND c.hora_maxima_confirmacion <= NOW()
    RETURNING cc.id, cc.citacion_id, cc.nombre, c.responsable_rut, c.tipo_competencia, c.competencia_nombre, c.rival_nombre, c.dia_citacion
  `);
  if (result.rows.length === 0) return;

  const porCitacion = new Map();
  result.rows.forEach((row) => {
    const lista = porCitacion.get(row.citacion_id) || [];
    lista.push(row);
    porCitacion.set(row.citacion_id, lista);
  });

  for (const [citacionId, filas] of porCitacion) {
    const info = filas[0];
    const destinatarios = await resolverDestinatariosRSVP(info.responsable_rut);
    const titulo = `Plazo vencido: ${filas.length} sin responder`;
    const cuerpo = `${filas.length} deportista(s) fueron marcados automáticamente como "no asiste" por no responder antes del plazo — ${info.tipo_competencia || ''} ${info.competencia_nombre || ''} vs ${info.rival_nombre || ''} (${formatearFechaCitacion(info.dia_citacion)}).`;
    await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
      rut, tipo: 'citacion_rsvp_automatico', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: citacionId,
    })));
  }
};

module.exports = {
  barrerCitacionesVencidas,
  crearNotificacionApp,
  formatearFechaCitacion,
  resolverDestinatariosCitacion,
  notificarExcepcionMorosidadPendiente,
  resolverDestinatariosRSVP,
};
