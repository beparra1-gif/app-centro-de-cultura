// Rutas de citaciones, convocatorias, notificaciones, eventos, asistencia y entrenamientos.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const { authenticate, requireModule, normalizarRutParaComparar, resolverPermisosDeActor, requireApoderadoDeJugador, requireAnyModule } = require('../security/auth');
const { normalizarRol } = require('../security/accessControl');
const { pool } = require('../lib/db');
const { barrerCitacionesVencidas, crearNotificacionApp, formatearFechaCitacion, notificarExcepcionMorosidadPendiente, resolverDestinatariosCitacion, resolverDestinatariosRSVP } = require('../lib/notificaciones');
const { ROLES_JUGADORES_ACOTADOS, citacionEsVisibleParaPupilos, obtenerPupilosDeActor } = require('../lib/actores');

const router = express.Router();

// ==========================================
// 11. ENDPOINTS: CONVOCATORIAS/CITACIONES (FASE 1)
// ==========================================

// GET: Todas las convocatorias
router.get('/api/convocatorias', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM convocatorias ORDER BY dia_partido DESC, hora_citacion ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/convocatorias]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear convocatoria
router.post('/api/convocatorias', authenticate, requireModule('citaciones'), async (req, res) => {
  const { rama, categoria, competencia, dia_partido, hora_citacion, hora_partido, lugar, entrenador } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO convocatorias 
       (rama, categoria, competencia, dia_partido, hora_citacion, hora_partido, lugar, entrenador, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activa')
       RETURNING *`,
      [rama, categoria, competencia, dia_partido, hora_citacion, hora_partido, lugar, entrenador]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/convocatorias]', err);
    res.status(500).json({ error: err.message });
  }
});

// Lista explícita de columnas de "citaciones" (en vez de SELECT/RETURNING *)
// para poder castear hora_maxima_confirmacion con to_char: es un TIMESTAMP
// sin timezone que pg parsearía a un JS Date interpretándolo con el timezone
// del PROCESO NODE (no el de la sesión de Postgres) — verificado que en un
// host con timezone distinta a Chile eso desfasa la hora al serializar a
// JSON. to_char devuelve el valor guardado tal cual, sin conversión alguna.
const CITACION_COLUMNAS_SQL = `
  id, tipo_competencia, competencia_nombre, competencia_logo_url,
  dia_citacion, hora_citacion, hora_presentacion,
  rival_nombre, rival_logo_url, rama, categoria_base, categorias_apoyo,
  responsable_nombre, responsable_rut, responsable_correo, responsable_rol,
  estado, creado_en, updated_at,
  to_char(hora_maxima_confirmacion, 'YYYY-MM-DD"T"HH24:MI') AS hora_maxima_confirmacion
`;

const cargarCitacionConConvocados = async (id) => {
  const citacionRes = await pool.query(`SELECT ${CITACION_COLUMNAS_SQL} FROM citaciones WHERE id = $1`, [id]);
  if (citacionRes.rows.length === 0) return null;
  // Se agrega jugadores.rut_apoderado (no vive en citacion_convocados) para
  // que el frontend identifique al apoderado por la MISMA columna que ya usa
  // requireApoderadoDeJugador para autorizar el RSVP, en vez de adivinar por correo.
  // fecha_nacimiento se agrega para la regla sub-13: a partir de esa edad el
  // propio jugador también puede responder su citación (ver ComunicacionesPanel).
  const convocadosRes = await pool.query(
    `SELECT cc.*, j.rut_apoderado, j.fecha_nacimiento
     FROM citacion_convocados cc
     LEFT JOIN jugadores j ON j.rut_jugador = cc.rut_jugador
     WHERE cc.citacion_id = $1
     ORDER BY cc.nombre ASC`,
    [id]
  );
  return { ...citacionRes.rows[0], convocados: convocadosRes.rows };
};

// POST: crear citación con su nómina inicial de convocados. Notifica al
// apoderado y, si existe, a la cuenta propia del jugador de cada convocado.
router.post('/api/citaciones', authenticate, requireModule('citaciones'), async (req, res) => {
  const {
    tipo_competencia, competencia_nombre, competencia_logo_url,
    dia_citacion, hora_citacion, hora_presentacion, hora_maxima_confirmacion,
    rival_nombre, rival_logo_url,
    rama, categoria_base, categorias_apoyo,
    convocados,
  } = req.body;

  if (!String(competencia_nombre || '').trim() || !String(rival_nombre || '').trim()) {
    return res.status(400).json({ error: 'Debes indicar la competencia y el equipo rival.' });
  }
  if (!Array.isArray(convocados) || convocados.length === 0) {
    return res.status(400).json({ error: 'Selecciona al menos un deportista para la citación.' });
  }

  const client = await pool.connect();
  try {
    const actorRow = await client.query('SELECT nombres, apellido_paterno, correo, rol FROM cuentas WHERE rut = $1', [req.actor.rut]);
    const actorCuenta = actorRow.rows[0] || {};
    const responsableNombre = `${actorCuenta.nombres || ''} ${actorCuenta.apellido_paterno || ''}`.trim() || actorCuenta.correo || 'Administración CCF';

    await client.query('BEGIN');
    const citacionRes = await client.query(
      `INSERT INTO citaciones
        (tipo_competencia, competencia_nombre, competencia_logo_url, dia_citacion, hora_citacion, hora_presentacion,
         hora_maxima_confirmacion,
         rival_nombre, rival_logo_url, rama, categoria_base, categorias_apoyo,
         responsable_nombre, responsable_rut, responsable_correo, responsable_rol)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING ${CITACION_COLUMNAS_SQL}`,
      [
        tipo_competencia || null, competencia_nombre, competencia_logo_url || null,
        dia_citacion || null, hora_citacion || null, hora_presentacion || null,
        hora_maxima_confirmacion || null,
        rival_nombre, rival_logo_url || null, rama || 'todas', categoria_base || 'todas',
        JSON.stringify(Array.isArray(categorias_apoyo) ? categorias_apoyo : []),
        responsableNombre, req.actor.rut, actorCuenta.correo || null, actorCuenta.rol || req.actor.rol,
      ]
    );
    const citacion = citacionRes.rows[0];

    for (const conv of convocados) {
      if (!String(conv.rut_jugador || '').trim()) continue;
      await client.query(
        `INSERT INTO citacion_convocados
          (citacion_id, rut_jugador, nombre, rama, categoria, correo_apoderado, requiere_excepcion_morosidad, estado_excepcion)
         VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 THEN 'solicitada' ELSE 'no_requiere' END)
         ON CONFLICT (citacion_id, rut_jugador) DO NOTHING`,
        [
          citacion.id, conv.rut_jugador, conv.nombre || '', conv.rama || '', conv.categoria || '',
          conv.correo_apoderado || null, Boolean(conv.requiere_excepcion_morosidad),
        ]
      );
    }

    await client.query('COMMIT');

    const destinatarios = await resolverDestinatariosCitacion(convocados);
    const titulo = `Citación ${citacion.tipo_competencia || ''}: ${citacion.competencia_nombre}`.trim();
    const cuerpo = `Convocatoria vs ${citacion.rival_nombre}. Día ${formatearFechaCitacion(citacion.dia_citacion)}, presentación ${citacion.hora_presentacion || '-'}.`;
    await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
      rut, tipo: 'citacion', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: citacion.id,
    })));

    await notificarExcepcionMorosidadPendiente(
      convocados.filter((c) => c.requiere_excepcion_morosidad),
      citacion,
      responsableNombre
    );

    const completa = await cargarCitacionConConvocados(citacion.id);
    res.status(201).json(completa);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/citaciones]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET: lista de citaciones visibles para el actor. Admin/super_admin con
// módulo citaciones ven todas; cualquier otra cuenta con el módulo (ej. un
// profesor con permiso individual) ve solo las que creó; el resto solo las
// suyas como convocado o las de la rama/categoría de sus pupilos.
router.get('/api/citaciones', authenticate, async (req, res) => {
  try {
    await barrerCitacionesVencidas();

    const citacionesRes = await pool.query(`SELECT ${CITACION_COLUMNAS_SQL} FROM citaciones ORDER BY dia_citacion DESC NULLS LAST, hora_citacion ASC`);
    const convocadosRes = await pool.query(
      `SELECT cc.*, j.rut_apoderado, j.fecha_nacimiento
       FROM citacion_convocados cc
       LEFT JOIN jugadores j ON j.rut_jugador = cc.rut_jugador
       ORDER BY cc.nombre ASC`
    );
    const convocadosPorCitacion = new Map();
    convocadosRes.rows.forEach((c) => {
      const lista = convocadosPorCitacion.get(c.citacion_id) || [];
      lista.push(c);
      convocadosPorCitacion.set(c.citacion_id, lista);
    });
    const citaciones = citacionesRes.rows.map((c) => ({ ...c, convocados: convocadosPorCitacion.get(c.id) || [] }));

    const permisos = await resolverPermisosDeActor(req.actor);
    const esAdminOSuper = ['admin', 'super_admin', 'superadmin'].includes(normalizarRol(req.actor.rol));
    if (permisos.citaciones && esAdminOSuper) {
      return res.json(citaciones);
    }
    if (permisos.citaciones) {
      const rutActor = normalizarRutParaComparar(req.actor.rut);
      return res.json(citaciones.filter((c) => normalizarRutParaComparar(c.responsable_rut) === rutActor));
    }

    const pupilos = await obtenerPupilosDeActor(req.actor);
    const visibles = citaciones.filter((c) => citacionEsVisibleParaPupilos(c, pupilos));
    res.json(visibles);
  } catch (err) {
    console.error('[GET /api/citaciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: detalle de una citación (mismas reglas de visibilidad que la lista).
router.get('/api/citaciones/:id', authenticate, async (req, res) => {
  try {
    await barrerCitacionesVencidas();

    const citacion = await cargarCitacionConConvocados(req.params.id);
    if (!citacion) return res.status(404).json({ error: 'Citación no encontrada.' });

    const permisos = await resolverPermisosDeActor(req.actor);
    const esAdminOSuper = ['admin', 'super_admin', 'superadmin'].includes(normalizarRol(req.actor.rol));
    if (permisos.citaciones && esAdminOSuper) {
      return res.json(citacion);
    }
    if (permisos.citaciones) {
      const rutActor = normalizarRutParaComparar(req.actor.rut);
      if (normalizarRutParaComparar(citacion.responsable_rut) !== rutActor) {
        return res.status(403).json({ error: 'No tienes acceso a esta citación.' });
      }
      return res.json(citacion);
    }

    const pupilos = await obtenerPupilosDeActor(req.actor);
    if (!citacionEsVisibleParaPupilos(citacion, pupilos)) {
      return res.status(403).json({ error: 'No tienes acceso a esta citación.' });
    }
    res.json(citacion);
  } catch (err) {
    console.error('[GET /api/citaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: edita los datos de una citación existente (fecha, rival, horarios,
// etc). No toca la nómina de convocados, que se gestiona aparte vía
// /convocados. Solo admin/super_admin o quien la creó pueden editarla.
router.put('/api/citaciones/:id', authenticate, requireModule('citaciones'), async (req, res) => {
  const {
    tipo_competencia, competencia_nombre, competencia_logo_url,
    dia_citacion, hora_citacion, hora_presentacion, hora_maxima_confirmacion,
    rival_nombre, rival_logo_url,
    rama, categoria_base, categorias_apoyo,
  } = req.body;

  try {
    const existente = await pool.query('SELECT responsable_rut FROM citaciones WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Citación no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin', 'superadmin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper && normalizarRutParaComparar(existente.rows[0].responsable_rut) !== normalizarRutParaComparar(req.actor.rut)) {
      return res.status(403).json({ error: 'No puedes editar una citación creada por otra persona.' });
    }

    await pool.query(
      `UPDATE citaciones
       SET tipo_competencia = COALESCE($1, tipo_competencia),
           competencia_nombre = COALESCE($2, competencia_nombre),
           competencia_logo_url = COALESCE($3, competencia_logo_url),
           dia_citacion = COALESCE($4, dia_citacion),
           hora_citacion = COALESCE($5, hora_citacion),
           hora_presentacion = COALESCE($6, hora_presentacion),
           hora_maxima_confirmacion = COALESCE($7, hora_maxima_confirmacion),
           rival_nombre = COALESCE($8, rival_nombre),
           rival_logo_url = COALESCE($9, rival_logo_url),
           rama = COALESCE($10, rama),
           categoria_base = COALESCE($11, categoria_base),
           categorias_apoyo = COALESCE($12, categorias_apoyo),
           updated_at = NOW()
       WHERE id = $13`,
      [
        tipo_competencia || null, competencia_nombre || null, competencia_logo_url || null,
        dia_citacion || null, hora_citacion || null, hora_presentacion || null,
        hora_maxima_confirmacion || null,
        rival_nombre || null, rival_logo_url || null,
        rama || null, categoria_base || null,
        Array.isArray(categorias_apoyo) ? JSON.stringify(categorias_apoyo) : null,
        req.params.id,
      ]
    );

    const completa = await cargarCitacionConConvocados(req.params.id);
    res.json(completa);
  } catch (err) {
    console.error('[PUT /api/citaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: borra una citación completa. citacion_convocados se limpia solo
// (ON DELETE CASCADE), pero comunicaciones.citacion_id no tiene FK (ver nota
// junto a ensureComunicacionesExtendedColumns) así que el post del muro
// vinculado se borra a mano, igual que en /api/academia-videos/:id. Solo
// admin/super_admin o quien la creó pueden borrarla.
router.delete('/api/citaciones/:id', authenticate, requireModule('citaciones'), async (req, res) => {
  const client = await pool.connect();
  try {
    const existente = await client.query('SELECT responsable_rut FROM citaciones WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Citación no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin', 'superadmin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper && normalizarRutParaComparar(existente.rows[0].responsable_rut) !== normalizarRutParaComparar(req.actor.rut)) {
      return res.status(403).json({ error: 'No puedes borrar una citación creada por otra persona.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM comunicaciones WHERE citacion_id = $1', [req.params.id]);
    await client.query('DELETE FROM citaciones WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DELETE /api/citaciones/:id]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST: agrega un convocado a una citación existente y lo notifica.
router.post('/api/citaciones/:id/convocados', authenticate, requireModule('citaciones'), async (req, res) => {
  const { rut_jugador, nombre, rama, categoria, correo_apoderado, requiere_excepcion_morosidad } = req.body;
  if (!String(rut_jugador || '').trim()) {
    return res.status(400).json({ error: 'Falta el RUT del deportista.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO citacion_convocados
        (citacion_id, rut_jugador, nombre, rama, categoria, correo_apoderado, requiere_excepcion_morosidad, estado_excepcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 THEN 'solicitada' ELSE 'no_requiere' END)
       ON CONFLICT (citacion_id, rut_jugador) DO NOTHING
       RETURNING *`,
      [req.params.id, rut_jugador, nombre || '', rama || '', categoria || '', correo_apoderado || null, Boolean(requiere_excepcion_morosidad)]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Ese deportista ya está en la nómina.' });
    }

    const citacion = await pool.query('SELECT tipo_competencia, competencia_nombre, rival_nombre, dia_citacion, hora_presentacion FROM citaciones WHERE id = $1', [req.params.id]);
    const destinatarios = await resolverDestinatariosCitacion([{ rut_jugador, correo_apoderado }]);
    const titulo = `Citación ${citacion.rows[0]?.tipo_competencia || ''}: ${citacion.rows[0]?.competencia_nombre || ''}`.trim();
    const cuerpo = `Convocatoria vs ${citacion.rows[0]?.rival_nombre || ''}. Día ${formatearFechaCitacion(citacion.rows[0]?.dia_citacion)}, presentación ${citacion.rows[0]?.hora_presentacion || '-'}.`;
    await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
      rut, tipo: 'citacion', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: Number(req.params.id),
    })));

    if (requiere_excepcion_morosidad) {
      const actorRow = await pool.query('SELECT nombres, apellido_paterno, correo FROM cuentas WHERE rut = $1', [req.actor.rut]);
      const actorNombre = `${actorRow.rows[0]?.nombres || ''} ${actorRow.rows[0]?.apellido_paterno || ''}`.trim() || actorRow.rows[0]?.correo;
      await notificarExcepcionMorosidadPendiente(
        [{ nombre: nombre || rut_jugador, rut_jugador }],
        { id: Number(req.params.id), ...citacion.rows[0] },
        actorNombre
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/citaciones/:id/convocados]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: admin/super_admin aprueba o rechaza la excepción de morosidad de un
// convocado (estado_excepcion 'solicitada' -> 'aprobada'/'rechazada'). Antes
// no existía ningún endpoint que resolviera esto — la fila quedaba en
// 'solicitada' para siempre sin que nadie se enterara ni pudiera actuar.
router.post('/api/citaciones/:id/convocados/:rut/resolver-excepcion', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { aprobar } = req.body;
  const nuevoEstado = aprobar ? 'aprobada' : 'rechazada';
  try {
    const result = await pool.query(
      `UPDATE citacion_convocados
       SET estado_excepcion = $1, actualizado_en = NOW()
       WHERE citacion_id = $2 AND rut_jugador = $3 AND estado_excepcion = 'solicitada'
       RETURNING *`,
      [nuevoEstado, req.params.id, req.params.rut]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hay una solicitud pendiente para ese convocado en esta citación.' });
    }

    const citaRow = await pool.query('SELECT responsable_rut, tipo_competencia, competencia_nombre, rival_nombre FROM citaciones WHERE id = $1', [req.params.id]);
    const cita = citaRow.rows[0];
    if (cita?.responsable_rut) {
      await crearNotificacionApp({
        rut: cita.responsable_rut,
        tipo: 'citacion_excepcion_resuelta',
        titulo: aprobar ? 'Autorización aprobada' : 'Autorización rechazada',
        cuerpo: `${result.rows[0].nombre || req.params.rut} ${aprobar ? 'fue autorizada/o' : 'no fue autorizada/o'} para citar a ${cita.tipo_competencia || ''} ${cita.competencia_nombre} vs ${cita.rival_nombre}.`.trim(),
        referenciaTipo: 'citacion',
        referenciaId: Number(req.params.id),
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/citaciones/:id/convocados/:rut/resolver-excepcion]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: quita un convocado de la nómina.
router.delete('/api/citaciones/:id/convocados/:rut', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM citacion_convocados WHERE citacion_id = $1 AND rut_jugador = $2',
      [req.params.id, req.params.rut]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/citaciones/:id/convocados/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH: marca asistencia real del día (staff escaneando el QR de la
// Tarjeta del jugador) — acción de staff, guard igual a agregar/quitar
// convocado, a diferencia del RSVP de abajo que solo puede hacer el
// apoderado. Independiente de "respuesta" (RSVP previo): confirmar
// asistencia no es lo mismo que haber llegado.
router.patch('/api/citaciones/:id/convocados/:rut/asistencia', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE citacion_convocados SET asistio_evento = true, hora_asistencia_marcada = NOW()
       WHERE citacion_id = $1 AND rut_jugador = $2 RETURNING *`,
      [req.params.id, req.params.rut]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Este jugador no está convocado a esta citación.' });
    }
    res.json(result.rows[0]);

    // Aviso puntual (no repetitivo como sería en cada entrenamiento) — tiene
    // valor real: confirma al apoderado que su hijo/a llegó bien a la citación.
    try {
      const citacion = await pool.query(
        'SELECT competencia_nombre, rival_nombre FROM citaciones WHERE id = $1', [req.params.id]
      );
      const destinatarios = await resolverDestinatariosCitacion([result.rows[0]]);
      const cuerpo = `${result.rows[0].nombre || 'El deportista'} fue registrado presente en ${citacion.rows[0]?.competencia_nombre || 'la citación'} vs ${citacion.rows[0]?.rival_nombre || ''}.`.trim();
      await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
        rut,
        tipo: 'asistencia',
        titulo: 'Asistencia confirmada',
        cuerpo,
        referenciaTipo: 'citacion',
        referenciaId: Number(req.params.id),
      })));
    } catch (notifErr) {
      console.error('[PATCH /api/citaciones/:id/convocados/:rut/asistencia] error notificando:', notifErr.message);
    }
  } catch (err) {
    console.error('[PATCH /api/citaciones/:id/convocados/:rut/asistencia]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH: confirma/rechaza la citación — solo el apoderado registrado del
// deportista puede responder (ni admin ni staff responden en su lugar).
// respuesta es opcional: el apoderado puede guardar solo un mensaje al
// profesor (o corregir la justificación) sin volver a confirmar/rechazar.
router.patch('/api/citaciones/:id/convocados/:rut/rsvp', authenticate, requireApoderadoDeJugador(pool), async (req, res) => {
  const { respuesta, justificacion, mensaje_profesor, excepcion_solicitada } = req.body;
  const hayRespuesta = respuesta !== undefined && respuesta !== null;

  if (hayRespuesta && !['si', 'no'].includes(respuesta)) {
    return res.status(400).json({ error: 'Respuesta inválida: debe ser "si" o "no".' });
  }
  if (respuesta === 'no' && !String(justificacion || '').trim()) {
    return res.status(400).json({ error: 'Debes indicar una justificación para rechazar la citación.' });
  }
  if (!hayRespuesta && mensaje_profesor === undefined && justificacion === undefined) {
    return res.status(400).json({ error: 'No hay ningún cambio para guardar.' });
  }

  const excepcionProvista = excepcion_solicitada === undefined || excepcion_solicitada === null
    ? null
    : Boolean(excepcion_solicitada);

  try {
    const result = await pool.query(
      `UPDATE citacion_convocados SET
        respuesta = COALESCE($1, respuesta),
        justificacion = COALESCE($2, justificacion),
        mensaje_profesor = COALESCE($3, mensaje_profesor),
        excepcion_solicitada = COALESCE($4, excepcion_solicitada),
        estado_excepcion = CASE WHEN $4 THEN 'solicitada' ELSE estado_excepcion END,
        respondido_automaticamente = CASE WHEN $1 IS NOT NULL THEN false ELSE respondido_automaticamente END,
        actualizado_en = NOW()
       WHERE citacion_id = $5 AND rut_jugador = $6
       RETURNING *`,
      [hayRespuesta ? respuesta : null, justificacion || null, mensaje_profesor || null, excepcionProvista, req.params.id, req.params.rut]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ese convocado en la citación.' });
    }
    const convocado = result.rows[0];

    // Notifica al profesor que creó la citación y a todo admin/superadmin —
    // solo cuando esta llamada realmente cambió sí/no (no en un guardado de
    // solo mensaje_profesor).
    if (hayRespuesta) {
      const citacionInfo = (await pool.query(
        'SELECT responsable_rut, tipo_competencia, competencia_nombre, rival_nombre, dia_citacion FROM citaciones WHERE id = $1',
        [req.params.id]
      )).rows[0];
      const destinatarios = await resolverDestinatariosRSVP(citacionInfo?.responsable_rut);
      const estado = convocado.respuesta === 'si'
        ? 'confirmó asistencia'
        : `rechazó la citación (${convocado.justificacion ? 'con justificación' : 'sin justificación'})`;
      const titulo = `Respuesta de citación: ${convocado.nombre || req.params.rut}`;
      const cuerpo = `${convocado.nombre || 'El deportista'} ${estado} — ${citacionInfo?.tipo_competencia || ''} ${citacionInfo?.competencia_nombre || ''} vs ${citacionInfo?.rival_nombre || ''} (${formatearFechaCitacion(citacionInfo?.dia_citacion)}).`;
      await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
        rut, tipo: 'citacion_rsvp', titulo, cuerpo, referenciaTipo: 'citacion', referenciaId: Number(req.params.id),
      })));
    }

    res.json(convocado);
  } catch (err) {
    console.error('[PATCH /api/citaciones/:id/convocados/:rut/rsvp]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/notificaciones', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notificaciones_app WHERE REPLACE(REPLACE(UPPER(rut_destinatario), '.', ''), '-', '') = $1
       ORDER BY creado_en DESC LIMIT 100`,
      [normalizarRutParaComparar(req.actor.rut)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/notificaciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH: marca una notificación propia como leída.
router.patch('/api/notificaciones/:id/leida', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notificaciones_app SET leida = true
       WHERE id = $1 AND REPLACE(REPLACE(UPPER(rut_destinatario), '.', ''), '-', '') = $2
       RETURNING *`,
      [req.params.id, normalizarRutParaComparar(req.actor.rut)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PATCH /api/notificaciones/:id/leida]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: borra una notificación propia (botón "Borrar" / al usar "Ir a").
router.delete('/api/notificaciones/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM notificaciones_app
       WHERE id = $1 AND REPLACE(REPLACE(UPPER(rut_destinatario), '.', ''), '-', '') = $2
       RETURNING id`,
      [req.params.id, normalizarRutParaComparar(req.actor.rut)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada.' });
    }
    res.json({ ok: true, deleted: { id: result.rows[0].id } });
  } catch (err) {
    console.error('[DELETE /api/notificaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 12. ENDPOINTS: EVENTOS (FASE 1)
// ==========================================

// GET: Todos los eventos
router.get('/api/eventos', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM eventos ORDER BY fecha DESC, hora ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/eventos]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear evento
router.post('/api/eventos', authenticate, requireModule('citaciones'), async (req, res) => {
  const { fecha, hora, titulo, lugar, descripcion } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO eventos (fecha, hora, titulo, lugar, descripcion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [fecha, hora, titulo, lugar, descripcion]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/eventos]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. ENDPOINTS: ASISTENCIA (FASE 1)
// ==========================================

// GET: Asistencia
// GET: lista de sesiones de asistencia (una fila por "pasar lista"), con
// conteos agregados — base del resumen filtrable por rama/categoría/profesor.
router.get('/api/asistencia/sesiones', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  const { rama, categoria, entrenador, desde, hasta } = req.query;
  try {
    const condiciones = [];
    const valores = [];
    if (rama && rama !== 'todas') {
      valores.push(rama);
      condiciones.push(`rama = $${valores.length}`);
    }
    if (categoria) {
      valores.push(categoria);
      condiciones.push(`categoria = $${valores.length}`);
    }
    if (entrenador) {
      valores.push(`%${entrenador}%`);
      condiciones.push(`entrenador_cargo ILIKE $${valores.length}`);
    }
    if (desde) {
      valores.push(desde);
      condiciones.push(`fecha >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(hasta);
      condiciones.push(`fecha <= $${valores.length}`);
    }
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
        sesion_id, fecha, rama, entrenador_cargo, hora_inicio, hora_fin,
        array_agg(DISTINCT categoria) FILTER (WHERE categoria IS NOT NULL AND categoria != '') AS categorias,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE LOWER(estado_asistencia) = 'presente') AS presentes,
        COUNT(*) FILTER (WHERE LOWER(estado_asistencia) = 'ausente') AS ausentes,
        COUNT(*) FILTER (WHERE LOWER(estado_asistencia) = 'justificado') AS justificados,
        MAX(created_at) AS creado_en
       FROM asistencia
       ${where}
       GROUP BY sesion_id, fecha, rama, entrenador_cargo, hora_inicio, hora_fin
       ORDER BY fecha DESC, creado_en DESC`,
      valores
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/asistencia/sesiones]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: detalle de una sesión (una fila por jugador).
router.get('/api/asistencia/sesiones/:sesionId', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM asistencia WHERE sesion_id = $1 ORDER BY nombre_jugador ASC`,
      [req.params.sesionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/asistencia/sesiones/:sesionId]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: resumen de asistencia de UN jugador (para su tarjeta/perfil) —
// cuenta los registros de las listas ya guardadas por staff. Mismo criterio
// de acceso que GET /api/jugadores/:rut: el propio jugador, su apoderado, o
// staff/admin vía obtenerPupilosDeActor.
router.get('/api/asistencia/jugador/:rut', authenticate, async (req, res) => {
  try {
    if (ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(req.actor.rol))) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
      if (!rutsPupilos.has(normalizarRutParaComparar(req.params.rut))) {
        return res.status(403).json({ error: 'No tienes acceso a este deportista.' });
      }
    }

    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE LOWER(estado_asistencia) IN ('presente', 'ausente', 'justificado')) AS total,
        COUNT(*) FILTER (WHERE LOWER(estado_asistencia) = 'presente') AS presentes,
        COUNT(*) FILTER (WHERE LOWER(estado_asistencia) = 'ausente') AS ausentes,
        COUNT(*) FILTER (WHERE LOWER(estado_asistencia) = 'justificado') AS justificados,
        MAX(fecha) FILTER (WHERE LOWER(estado_asistencia) = 'presente') AS ultima_presente
       FROM asistencia
       WHERE rut_jugador = $1`,
      [req.params.rut]
    );
    const fila = result.rows[0] || {};
    const total = Number(fila.total || 0);
    const presentes = Number(fila.presentes || 0);

    // Detalle para que el apoderado vea algo más que un %: últimos
    // entrenamientos (tabla asistencia) y últimas citaciones/torneos a los
    // que fue convocado (citacion_convocados + citaciones), con si quedó
    // registrado presente vía QR (asistio_evento).
    const historialEntrenamientos = await pool.query(
      `SELECT fecha, estado_asistencia, observacion
       FROM asistencia
       WHERE rut_jugador = $1
       ORDER BY fecha DESC, created_at DESC
       LIMIT 10`,
      [req.params.rut]
    );
    const historialCitaciones = await pool.query(
      `SELECT c.dia_citacion, c.competencia_nombre, c.rival_nombre, c.tipo_competencia,
              cc.respuesta, cc.asistio_evento
       FROM citacion_convocados cc
       JOIN citaciones c ON c.id = cc.citacion_id
       WHERE cc.rut_jugador = $1
       ORDER BY c.dia_citacion DESC
       LIMIT 10`,
      [req.params.rut]
    );

    res.json({
      total,
      presentes,
      ausentes: Number(fila.ausentes || 0),
      justificados: Number(fila.justificados || 0),
      porcentaje: total > 0 ? Math.round((presentes / total) * 100) : null,
      ultima_presente: fila.ultima_presente || null,
      historialEntrenamientos: historialEntrenamientos.rows,
      historialCitaciones: historialCitaciones.rows,
    });
  } catch (err) {
    console.error('[GET /api/asistencia/jugador/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: promedio de estadísticas de juego de UN jugador (para su Tarjeta) —
// mismo criterio de acceso que GET /api/asistencia/jugador/:rut. Sin
// partidos registrados, "partidos: 0" — el frontend muestra un mensaje
// honesto en vez de inventar promedios en 0.
router.get('/api/estadisticas/jugador/:rut/resumen', authenticate, async (req, res) => {
  try {
    if (ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(req.actor.rol))) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
      if (!rutsPupilos.has(normalizarRutParaComparar(req.params.rut))) {
        return res.status(403).json({ error: 'No tienes acceso a este deportista.' });
      }
    }

    const result = await pool.query(
      `SELECT
        COUNT(*) AS partidos,
        COALESCE(AVG(puntos), 0) AS pts,
        COALESCE(AVG(rebotes), 0) AS reb,
        COALESCE(AVG(asistencias), 0) AS ast
       FROM estadisticas
       WHERE rut_jugador = $1`,
      [req.params.rut]
    );
    const fila = result.rows[0] || {};
    res.json({
      partidos: Number(fila.partidos || 0),
      pts: Math.round(Number(fila.pts || 0) * 10) / 10,
      reb: Math.round(Number(fila.reb || 0) * 10) / 10,
      ast: Math.round(Number(fila.ast || 0) * 10) / 10,
    });
  } catch (err) {
    console.error('[GET /api/estadisticas/jugador/:rut/resumen]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: registra una sesión completa de una sola vez (todo el roster de esa
// pasada de lista), en una transacción con un sesion_id común.
router.post('/api/asistencia/sesion', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  const { fecha, rama, hora_inicio, hora_fin, entrenador_cargo, registros } = req.body;
  if (!Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ error: 'No hay registros de asistencia para guardar.' });
  }

  const sesionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const registro of registros) {
      await client.query(
        `INSERT INTO asistencia
          (sesion_id, fecha, rama, categoria, rut_jugador, nombre_jugador, estado_asistencia, observacion, entrenador_cargo, hora_inicio, hora_fin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          sesionId, fecha || null, rama || null, registro.categoria || null,
          registro.rut_jugador || null, registro.nombre_jugador || '', registro.estado_asistencia || 'pendiente',
          registro.observacion || null, entrenador_cargo || null, hora_inicio || null, hora_fin || null,
        ]
      );
    }
    await client.query('COMMIT');
    const creada = await pool.query('SELECT * FROM asistencia WHERE sesion_id = $1 ORDER BY nombre_jugador ASC', [sesionId]);
    res.status(201).json({ sesion_id: sesionId, registros: creada.rows });

    // XP real por asistencia confirmada — antes la tarjeta mostraba
    // "Asistencia" como parte del progreso de nivel sin que ninguna acción
    // real sumara XP (el único mecanismo activo era el quiz semanal). No
    // bloquea la respuesta: si falla no debe tumbar el guardado de la lista.
    const presentes = registros.filter((r) => r.estado_asistencia === 'presente' && r.rut_jugador);
    for (const registro of presentes) {
      try {
        await pool.query(
          `INSERT INTO gamificacion_puntos (rut_jugador, tipo_logro, puntos_obtenidos, descripcion)
           VALUES ($1, 'asistencia_confirmada', 10, $2)`,
          [registro.rut_jugador, `Asistencia a entrenamiento del ${fecha || 'día'}`]
        );
      } catch (xpErr) {
        console.error('[POST /api/asistencia/sesion] error sumando XP de asistencia:', xpErr.message);
      }
    }

    // Avisar solo lo accionable: ausencia SIN aviso (no "justificado", que ya
    // implica que el apoderado avisó antes). No se avisa "presente" en cada
    // entrenamiento — con 2-3 sesiones por semana sería puro ruido.
    const ausentesSinAviso = registros.filter((r) => r.estado_asistencia === 'ausente' && r.rut_jugador);
    for (const registro of ausentesSinAviso) {
      try {
        const destinatarios = await resolverDestinatariosCitacion([{ rut_jugador: registro.rut_jugador }]);
        await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
          rut,
          tipo: 'asistencia',
          titulo: 'Ausencia en entrenamiento',
          cuerpo: `${registro.nombre_jugador || 'El deportista'} no registró asistencia en el entrenamiento del ${fecha || 'día de hoy'}.`,
          referenciaTipo: 'asistencia',
          referenciaId: null,
        })));
      } catch (notifErr) {
        console.error('[POST /api/asistencia/sesion] error notificando ausencia:', notifErr.message);
      }
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/asistencia/sesion]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT: corrige el estado/observación de un jugador dentro de una sesión ya guardada.
router.put('/api/asistencia/:id', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  const { estado_asistencia, observacion } = req.body;
  try {
    const result = await pool.query(
      `UPDATE asistencia SET
        estado_asistencia = COALESCE($1, estado_asistencia),
        observacion = COALESCE($2, observacion),
        updated_at = NOW()
       WHERE id_asistencia = $3
       RETURNING *`,
      [estado_asistencia || null, observacion, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de asistencia no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/asistencia/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: borra un registro individual (un jugador dentro de una sesión).
router.delete('/api/asistencia/:id', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  try {
    await pool.query('DELETE FROM asistencia WHERE id_asistencia = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/asistencia/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: borra una sesión completa (toda una pasada de lista).
router.delete('/api/asistencia/sesiones/:sesionId', authenticate, requireAnyModule('citaciones', 'asistencia_staff'), async (req, res) => {
  try {
    await pool.query('DELETE FROM asistencia WHERE sesion_id = $1', [req.params.sesionId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/asistencia/sesiones/:sesionId]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 33. ENDPOINTS: ENTRENAMIENTOS (FASE 3)
// ==========================================

router.get('/api/entrenamientos', authenticate, requireAnyModule('asistencia_staff', 'evaluacion_staff', 'academia'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM entrenamientos ORDER BY fecha_entrenamiento DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/entrenamientos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/entrenamientos', authenticate, requireAnyModule('asistencia_staff', 'evaluacion_staff'), async (req, res) => {
  const { rama, categoria, fecha_entrenamiento, hora_inicio, hora_fin, lugar, entrenador_a_cargo, tema_entrenamiento, capacidad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO entrenamientos (rama, categoria, fecha_entrenamiento, hora_inicio, hora_fin, lugar, entrenador_a_cargo, tema_entrenamiento, capacidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [rama, categoria, fecha_entrenamiento, hora_inicio, hora_fin, lugar, entrenador_a_cargo, tema_entrenamiento, capacidad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/entrenamientos]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 35. ENDPOINTS: ASISTENCIA EVENTOS DETALLE (FASE 3)
// ==========================================

router.get('/api/asistencia-eventos/:eventoId', authenticate, requireModule('citaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM asistencia_eventos_detalle WHERE id_evento = $1 ORDER BY fecha_confirmacion DESC`,
      [req.params.eventoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/asistencia-eventos/:eventoId]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/asistencia-eventos', authenticate, requireModule('citaciones'), async (req, res) => {
  const { id_evento, rut_persona, tipo_persona, estado_confirmacion, transporte_requerido } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO asistencia_eventos_detalle (id_evento, rut_persona, tipo_persona, estado_confirmacion, transporte_requerido, fecha_confirmacion)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [id_evento, rut_persona, tipo_persona, estado_confirmacion, transporte_requerido || false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/asistencia-eventos]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
