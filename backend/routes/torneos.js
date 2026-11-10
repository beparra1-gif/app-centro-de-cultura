// Rutas de torneos (cuadro, equipos, posiciones), partidos en vivo, estadísticas, resultados, pizarra y clubes.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const { authenticate, requireAnyModule, requireModule } = require('../security/auth');
const { calcularEmparejamientos } = require('../torneoBracket');
const { pool } = require('../lib/db');

const router = express.Router();

// ==========================================
// 14. ENDPOINTS: PARTIDOS EN VIVO (FASE 1)
// ==========================================

// GET: Partidos en vivo
router.get('/api/partidos-live', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM partidos_live ORDER BY fecha_hora DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/partidos-live]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Historial mesa con filtros
router.get('/api/partidos-live/historial', async (req, res) => {
  try {
    const {
      rival = '',
      torneo = '',
      rama = '',
      categoria = '',
      limit = '40',
    } = req.query || {};

    const valores = [];
    const where = [`(estado_juego ILIKE 'finalizado' OR finalizado_at IS NOT NULL)`];

    if (String(rival || '').trim()) {
      valores.push(`%${String(rival).trim()}%`);
      where.push(`equipo_visitante ILIKE $${valores.length}`);
    }
    if (String(torneo || '').trim()) {
      valores.push(`%${String(torneo).trim()}%`);
      where.push(`COALESCE(competencia_nombre, torneo_nombre, '') ILIKE $${valores.length}`);
    }
    if (String(rama || '').trim()) {
      valores.push(String(rama).trim());
      where.push(`COALESCE(rama, '') ILIKE $${valores.length}`);
    }
    if (String(categoria || '').trim()) {
      valores.push(String(categoria).trim());
      where.push(`COALESCE(categoria, '') ILIKE $${valores.length}`);
    }

    const limite = Math.min(200, Math.max(5, Number(limit) || 40));
    valores.push(limite);

    const result = await pool.query(
      `SELECT id_partido, fecha_hora, cancha_sede, rama, categoria,
              equipo_local, equipo_visitante,
              logo_local_url, logo_visitante_url,
              COALESCE(competencia_nombre, torneo_nombre) AS competencia_nombre,
              COALESCE(competencia_logo_url, torneo_logo_url) AS competencia_logo_url,
              pts_local, pts_visitante, estado_juego, iniciado_at, finalizado_at,
              mesa_payload, play_by_play_json, eventos_json, operadores_json, analisis_json,
              created_at, updated_at
       FROM partidos_live
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(finalizado_at, updated_at, fecha_hora, created_at) DESC
       LIMIT $${valores.length}`,
      valores
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/partidos-live/historial]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear partido
router.post('/api/partidos-live', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'resultados', 'torneos'), async (req, res) => {
  const {
    fecha_hora, cancha_sede, categoria_rama, rama, categoria, equipo_local, equipo_visitante,
    rut_planillero, estado_juego,
    logo_local_url, logo_visitante_url, torneo_nombre, torneo_logo_url, id_torneo,
    id_equipo_local, id_equipo_visitante,
    pts_local, pts_visitante, publicado,
  } = req.body;
  try {
    // Use new rama/categoria if provided, otherwise use old categoria_rama for backward compatibility
    const ramafinal = rama || 'Mixta';
    const categoriafinal = categoria || 'SUB-13';
    const categoria_rama_final = categoria_rama || `${ramafinal}-${categoriafinal}`;

    const result = await pool.query(
      `INSERT INTO partidos_live
       (fecha_hora, cancha_sede, categoria_rama, rama, categoria, equipo_local, equipo_visitante, rut_planillero,
        estado_juego, logo_local_url, logo_visitante_url, torneo_nombre, torneo_logo_url, id_torneo,
        id_equipo_local, id_equipo_visitante,
        pts_local, pts_visitante, publicado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9,'pendiente'), $10, $11, $12, $13, $14, $15, $16,
        COALESCE($17, 0), COALESCE($18, 0), COALESCE($19, true))
       RETURNING *`,
      [
        fecha_hora, cancha_sede, categoria_rama_final, ramafinal, categoriafinal,
        equipo_local, equipo_visitante, rut_planillero || null,
        estado_juego || 'pendiente',
        logo_local_url || null, logo_visitante_url || null,
        torneo_nombre || null, torneo_logo_url || null, id_torneo || null,
        id_equipo_local || null, id_equipo_visitante || null,
        pts_local ?? 0, pts_visitante ?? 0, publicado,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/partidos-live]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar marcador
router.put('/api/partidos-live/:id', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'resultados', 'torneos'), async (req, res) => {
  const {
    pts_local,
    pts_visitante,
    estado_juego,
    periodo_actual,
    fecha_hora,
    cancha_sede,
    categoria_rama,
    rama,
    categoria,
    equipo_local,
    equipo_visitante,
    logo_local_url,
    logo_visitante_url,
    torneo_nombre,
    torneo_logo_url,
    id_torneo,
    id_equipo_local,
    id_equipo_visitante,
    publicado,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE partidos_live
       SET pts_local = COALESCE($1, pts_local),
           pts_visitante = COALESCE($2, pts_visitante),
           estado_juego = COALESCE($3, estado_juego),
           periodo_actual = COALESCE($4, periodo_actual),
           fecha_hora = COALESCE($5, fecha_hora),
           cancha_sede = COALESCE($6, cancha_sede),
           categoria_rama = COALESCE($7, categoria_rama),
           rama = COALESCE($8, rama),
           categoria = COALESCE($9, categoria),
           equipo_local = COALESCE($10, equipo_local),
           equipo_visitante = COALESCE($11, equipo_visitante),
           logo_local_url = COALESCE($12, logo_local_url),
           logo_visitante_url = COALESCE($13, logo_visitante_url),
           torneo_nombre = COALESCE($14, torneo_nombre),
           torneo_logo_url = COALESCE($15, torneo_logo_url),
           id_torneo = COALESCE($16, id_torneo),
           publicado = COALESCE($17, publicado),
           id_equipo_local = COALESCE($18, id_equipo_local),
           id_equipo_visitante = COALESCE($19, id_equipo_visitante),
           updated_at = NOW()
       WHERE id_partido = $20
       RETURNING *`,
      [
        pts_local,
        pts_visitante,
        estado_juego,
        periodo_actual,
        fecha_hora,
        cancha_sede,
        categoria_rama,
        rama,
        categoria,
        equipo_local,
        equipo_visitante,
        logo_local_url,
        logo_visitante_url,
        torneo_nombre,
        torneo_logo_url,
        id_torneo,
        publicado,
        id_equipo_local,
        id_equipo_visitante,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }
    if (result.rows[0].estado_juego === 'finalizado' && result.rows[0].ronda_bracket != null) {
      await avanzarGanadorBracket(result.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/partidos-live/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Finalizar partido desde mesa avanzada (persistencia historica + trazabilidad)
router.post('/api/partidos-live/:id/finalizar-mesa', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const {
    mesa_payload,
    play_by_play_json,
    eventos_json,
    operadores_json,
    analisis_json,
    competencia_nombre,
    competencia_logo_url,
    cancha_sede,
    pts_local,
    pts_visitante,
    id_torneo,
    publicado,
  } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE partidos_live
       SET estado_juego = 'finalizado',
           finalizado_at = COALESCE(finalizado_at, NOW()),
           iniciado_at = COALESCE(iniciado_at, NOW()),
           mesa_payload = COALESCE($1::jsonb, mesa_payload),
           play_by_play_json = COALESCE($2::jsonb, play_by_play_json),
           eventos_json = COALESCE($3::jsonb, eventos_json),
           operadores_json = COALESCE($4::jsonb, operadores_json),
           analisis_json = COALESCE($5::jsonb, analisis_json),
           competencia_nombre = COALESCE($6, competencia_nombre, torneo_nombre),
           competencia_logo_url = COALESCE($7, competencia_logo_url, torneo_logo_url),
           cancha_sede = COALESCE($8, cancha_sede),
           pts_local = COALESCE($9, pts_local),
           pts_visitante = COALESCE($10, pts_visitante),
           id_torneo = COALESCE($11, id_torneo),
           publicado = COALESCE($12, publicado),
           updated_at = NOW()
       WHERE id_partido = $13
       RETURNING *`,
      [
        mesa_payload ? JSON.stringify(mesa_payload) : null,
        play_by_play_json ? JSON.stringify(play_by_play_json) : null,
        eventos_json ? JSON.stringify(eventos_json) : null,
        operadores_json ? JSON.stringify(operadores_json) : null,
        analisis_json ? JSON.stringify(analisis_json) : null,
        competencia_nombre || null,
        competencia_logo_url || null,
        cancha_sede || null,
        pts_local ?? null,
        pts_visitante ?? null,
        id_torneo || null,
        publicado,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/partidos-live/:id/finalizar-mesa]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Eliminar un partido
router.delete('/api/partidos-live/:id', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Limpiar registros relacionados para evitar errores de llave foranea.
    await client.query(`DELETE FROM resultados WHERE id_partido = $1`, [req.params.id]);
    await client.query(`DELETE FROM estadisticas WHERE id_partido = $1`, [req.params.id]);
    await client.query(`DELETE FROM marcas_tiempo WHERE id_partido = $1`, [req.params.id]);
    await client.query(`DELETE FROM pizarra_tactica WHERE id_partido = $1`, [req.params.id]);

    const result = await client.query(
      `DELETE FROM partidos_live WHERE id_partido = $1 RETURNING id_partido`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Partido eliminado correctamente' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors and return original error.
    }
    console.error('[DELETE /api/partidos-live/:id]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 15. ENDPOINTS: ESTADÍSTICAS (FASE 2)
// ==========================================

// GET: Estadísticas de un partido
router.get('/api/estadisticas/partido/:partidoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, j.nombres, j.apellido_paterno
       FROM estadisticas e
       LEFT JOIN jugadores j ON e.rut_jugador = j.rut_jugador
       WHERE e.id_partido = $1
       ORDER BY e.puntos DESC`,
      [req.params.partidoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/estadisticas/partido/:partidoId]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear estadística
router.post('/api/estadisticas', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const { id_partido, rut_jugador, puntos, rebotes, asistencias, robos, tapones, faltas_cometidas, porcentaje_efectividad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO estadisticas (id_partido, rut_jugador, puntos, rebotes, asistencias, robos, tapones, faltas_cometidas, porcentaje_efectividad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id_partido, rut_jugador, puntos, rebotes, asistencias, robos, tapones, faltas_cometidas, porcentaje_efectividad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/estadisticas]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 19. ENDPOINTS: RESULTADOS (FASE 2)
// ==========================================

// GET: Resultado de un partido
router.get('/api/resultados/partido/:partidoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM resultados WHERE id_partido = $1`,
      [req.params.partidoId]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('[GET /api/resultados/partido/:partidoId]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear resultado
router.post('/api/resultados', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const { id_partido, equipo_ganador, puntos_local, puntos_visitante, validado_por } = req.body;
  try {
    const diferencia = Math.abs(puntos_local - puntos_visitante);
    const result = await pool.query(
      `INSERT INTO resultados (id_partido, equipo_ganador, puntos_local, puntos_visitante, diferencia_puntos, validado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id_partido, equipo_ganador, puntos_local, puntos_visitante, diferencia, validado_por]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/resultados]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 21. ENDPOINTS: PIZARRA TÁCTICA (FASE 2)
// ==========================================

// GET: Tácticas de un partido
router.get('/api/pizarra/partido/:partidoId', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pizarra_tactica WHERE id_partido = $1 ORDER BY fecha_tactica DESC`,
      [req.params.partidoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/pizarra/partido/:partidoId]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear táctica
router.post('/api/pizarra', authenticate, requireModule('scoreboard_live'), async (req, res) => {
  const { id_partido, entrenador_rut, nombre_tactica, descripcion, formacion, zona_defensa, zona_ataque } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO pizarra_tactica (id_partido, entrenador_rut, nombre_tactica, descripcion, formacion, zona_defensa, zona_ataque)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id_partido, entrenador_rut, nombre_tactica, descripcion, formacion, zona_defensa, zona_ataque]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/pizarra]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 26. ENDPOINTS: TORNEOS (FASE 3)
// ==========================================

// Lectura pública (mismo criterio que GET /api/partidos-live y GET
// /api/resultados/partido/:id): cualquiera puede ver qué torneos existen y su
// tabla de posiciones, incluso sin sesión, para mostrarlo en la fachada
// pública. Crear/editar torneos sigue exigiendo admin o staff con Mesa.
router.get('/api/torneos', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM torneos ORDER BY fecha_inicio DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/torneos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/torneos', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'torneos'), async (req, res) => {
  const { nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato, tipo, tipo_formato, publicar_resultado_en_muro } = req.body;
  const tipoFinal = tipo === 'externo' ? 'externo' : 'interno';
  const tipoFormatoFinal = tipo_formato === 'eliminacion_directa' ? 'eliminacion_directa' : 'liga';
  if (tipoFinal === 'externo' && !String(organizador || '').trim()) {
    return res.status(400).json({ error: 'Indica el club u organización que organiza el torneo externo.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO torneos (nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato, estado, tipo, tipo_formato, publicar_resultado_en_muro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activo', $10, $11, $12)
       RETURNING *`,
      [nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato, tipoFinal, tipoFormatoFinal, publicar_resultado_en_muro !== false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/torneos]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: editar un torneo — tanto los campos de gestión (estado, ganador,
// etc., sin los cuales "ganador"/"estado" quedaban huérfanos en el esquema)
// como los datos básicos (nombre, fechas, formato...). Edición parcial: solo
// se tocan las columnas que vienen en el body. Si se marca como finalizado
// con un ganador, dispara el post automático al Muro (según el opt-out del
// propio torneo).
router.put('/api/torneos/:id', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'torneos'), async (req, res) => {
  const {
    estado, ganador, subcampeon, premios, publicar_resultado_en_muro,
    nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, tipo, tipo_formato, cantidad_equipos,
  } = req.body;
  try {
    const actual = (await pool.query('SELECT * FROM torneos WHERE id_torneo = $1', [req.params.id])).rows[0];
    if (!actual) {
      return res.status(404).json({ error: 'Torneo no encontrado.' });
    }

    const tipoFinal = tipo === 'externo' ? 'externo' : (tipo === 'interno' ? 'interno' : actual.tipo);
    const organizadorFinal = organizador !== undefined ? organizador : actual.organizador;
    if (tipoFinal === 'externo' && !String(organizadorFinal || '').trim()) {
      return res.status(400).json({ error: 'Indica el club u organización que organiza el torneo externo.' });
    }

    // Cambiar el formato de un torneo que ya tiene equipos o cuadro armado
    // dejaría partidos_live apuntando a rondas/posiciones que no
    // corresponden al nuevo formato — se bloquea antes de tocar nada.
    if (tipo_formato && tipo_formato !== actual.tipo_formato) {
      const tieneEquipos = Number((await pool.query(
        'SELECT COUNT(*) FROM torneo_equipos WHERE id_torneo = $1', [req.params.id]
      )).rows[0].count) > 0;
      if (tieneEquipos || actual.bracket_generado) {
        return res.status(400).json({ error: 'No se puede cambiar el formato de un torneo que ya tiene equipos o cuadro generado.' });
      }
    }

    const result = await pool.query(
      `UPDATE torneos SET
        estado = COALESCE($1, estado),
        ganador = COALESCE($2, ganador),
        "subcampeón" = COALESCE($3, "subcampeón"),
        premios = COALESCE($4, premios),
        publicar_resultado_en_muro = COALESCE($5, publicar_resultado_en_muro),
        nombre_torneo = COALESCE($6, nombre_torneo),
        rama = COALESCE($7, rama),
        categoria = COALESCE($8, categoria),
        fecha_inicio = COALESCE($9, fecha_inicio),
        fecha_fin = COALESCE($10, fecha_fin),
        ubicacion = COALESCE($11, ubicacion),
        organizador = COALESCE($12, organizador),
        tipo = COALESCE($13, tipo),
        tipo_formato = COALESCE($14, tipo_formato),
        cantidad_equipos = COALESCE($15, cantidad_equipos),
        updated_at = NOW()
       WHERE id_torneo = $16
       RETURNING *`,
      [
        estado || null, ganador || null, subcampeon || null, premios || null, publicar_resultado_en_muro ?? null,
        nombre_torneo || null, rama || null, categoria || null, fecha_inicio || null, fecha_fin || null,
        ubicacion || null, organizador || null, tipo || null, tipo_formato || null, cantidad_equipos || null,
        req.params.id,
      ]
    );
    if (estado === 'finalizado' && ganador) {
      await publicarResultadoTorneoEnMuro(req.params.id);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/torneos/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: borra un torneo y todo lo que le pertenece. torneo_equipos cae
// solo (FK con ON DELETE CASCADE), pero partidos_live.id_torneo es un
// vínculo débil sin FK (a propósito, ver comentario donde se agrega la
// columna) — si no se borran a mano acá, quedan partidos huérfanos
// apuntando a un id_torneo que ya no existe.
router.delete('/api/torneos/:id', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'torneos'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const torneo = (await client.query('SELECT id_torneo FROM torneos WHERE id_torneo = $1', [req.params.id])).rows[0];
    if (!torneo) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Torneo no encontrado.' });
    }
    await client.query('DELETE FROM partidos_live WHERE id_torneo = $1', [req.params.id]);
    await client.query('DELETE FROM torneos WHERE id_torneo = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DELETE /api/torneos/:id]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST: arma el cuadro de eliminación directa emparejando los equipos ya
// agregados por orden de alta (equipo 1 vs 2, 3 vs 4, ...) — sin sorteo ni
// sembrado, alcanza para un club chico. No exige potencia de 2: si sobran
// equipos, los primeros pasan directo a la ronda 2 (ver calcularEmparejamientos).
router.post('/api/torneos/:id/generar-cuadro', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'torneos'), async (req, res) => {
  try {
    const torneo = (await pool.query('SELECT * FROM torneos WHERE id_torneo = $1', [req.params.id])).rows[0];
    if (!torneo) {
      return res.status(404).json({ error: 'Torneo no encontrado.' });
    }
    if (torneo.tipo_formato !== 'eliminacion_directa') {
      return res.status(400).json({ error: 'Este torneo no es de formato eliminación directa.' });
    }
    if (torneo.bracket_generado) {
      return res.status(400).json({ error: 'El cuadro de este torneo ya fue generado.' });
    }

    const equipos = (await pool.query('SELECT * FROM torneo_equipos WHERE id_torneo = $1 ORDER BY id_equipo ASC', [req.params.id])).rows;
    if (equipos.length < 2) {
      return res.status(400).json({ error: 'Necesitas al menos 2 equipos para generar el cuadro.' });
    }

    // Reclamo atómico antes de insertar: si dos requests llegan casi juntos
    // (doble click), la primera en ejecutar este UPDATE gana y la segunda
    // encuentra bracket_generado ya en true y no llega a duplicar partidos.
    const reclamo = await pool.query(
      `UPDATE torneos SET bracket_generado = true WHERE id_torneo = $1 AND bracket_generado = false RETURNING id_torneo`,
      [req.params.id]
    );
    if (reclamo.rows.length === 0) {
      return res.status(400).json({ error: 'El cuadro de este torneo ya fue generado.' });
    }

    const { partidosReales, pasesDirectos, totalRondas } = calcularEmparejamientos(equipos);
    const meta = { rama: torneo.rama, categoria: torneo.categoria, torneoNombre: torneo.nombre_torneo };

    for (const { posicion, local, visita } of partidosReales) {
      await colocarEnBracket(req.params.id, 1, posicion, true, local, meta);
      await colocarEnBracket(req.params.id, 1, posicion, false, visita, meta);
    }
    for (const { posicion, esLocal, equipo } of pasesDirectos) {
      await colocarEnBracket(req.params.id, 2, posicion, esLocal, equipo, meta);
    }

    res.json({ ok: true, rondas: totalRondas, partidosCreados: partidosReales.length, pasesDirectos: pasesDirectos.length });
  } catch (err) {
    console.error('[POST /api/torneos/:id/generar-cuadro]', err);
    res.status(500).json({ error: err.message });
  }
});

// Coloca un equipo en un lado (local o visita) de la posición de un cuadro
// de eliminación directa. Si el partido en esa (ronda, posicion) todavía no
// existe, lo crea con ese lado lleno y el otro vacío (a la espera de un
// pase directo o de que se resuelva el cruce que lo alimenta); si ya
// existe, solo actualiza ese lado sin tocar el otro. Un mismo helper cubre
// armar la ronda 1, colocar los pases directos, y el avance de ganadores.
const colocarEnBracket = async (idTorneo, ronda, posicion, esLocal, equipo, meta) => {
  const nombre = equipo.nombre_equipo || equipo.nombre || null;
  const idEquipo = equipo.id_equipo ?? equipo.id ?? null;
  const logo = equipo.logo_url || equipo.logo || null;

  const existente = (await pool.query(
    `SELECT id_partido FROM partidos_live WHERE id_torneo = $1 AND ronda_bracket = $2 AND posicion_bracket = $3`,
    [idTorneo, ronda, posicion]
  )).rows[0];

  if (existente) {
    const columnas = esLocal
      ? 'equipo_local = $1, id_equipo_local = $2, logo_local_url = $3'
      : 'equipo_visitante = $1, id_equipo_visitante = $2, logo_visitante_url = $3';
    await pool.query(`UPDATE partidos_live SET ${columnas} WHERE id_partido = $4`, [nombre, idEquipo, logo, existente.id_partido]);
    return;
  }

  const columnasLocal = esLocal ? [nombre, idEquipo, logo] : [null, null, null];
  const columnasVisita = esLocal ? [null, null, null] : [nombre, idEquipo, logo];
  await pool.query(
    `INSERT INTO partidos_live (id_torneo, ronda_bracket, posicion_bracket, equipo_local, equipo_visitante,
     id_equipo_local, id_equipo_visitante, logo_local_url, logo_visitante_url, estado_juego, rama, categoria,
     torneo_nombre, pts_local, pts_visitante)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10,$11,$12,0,0)`,
    [idTorneo, ronda, posicion, columnasLocal[0], columnasVisita[0], columnasLocal[1], columnasVisita[1],
     columnasLocal[2], columnasVisita[2], meta.rama, meta.categoria, meta.torneoNombre]
  );
};

// Al finalizar un partido de bracket, coloca a su ganador en el lado que le
// corresponde (según la paridad de su posición) del partido de la ronda
// siguiente — sin esperar a que ningún "hermano" termine, cada partido
// escribe su propio resultado de forma independiente. Si esta era la
// última ronda, cierra el torneo (ganador + estado) y dispara el post al
// Muro.
const avanzarGanadorBracket = async (partido) => {
  const { id_torneo, ronda_bracket, posicion_bracket } = partido;
  if (ronda_bracket == null || posicion_bracket == null) return;

  const totalEquipos = Number((await pool.query(
    'SELECT COUNT(*) FROM torneo_equipos WHERE id_torneo = $1', [id_torneo]
  )).rows[0].count);
  const totalRondas = Math.ceil(Math.log2(totalEquipos || 1));
  const ganador = (p) => (Number(p.pts_local) >= Number(p.pts_visitante))
    ? { id_equipo: p.id_equipo_local, nombre_equipo: p.equipo_local, logo_url: p.logo_local_url }
    : { id_equipo: p.id_equipo_visitante, nombre_equipo: p.equipo_visitante, logo_url: p.logo_visitante_url };

  if (ronda_bracket >= totalRondas) {
    const campeon = ganador(partido);
    await pool.query(
      `UPDATE torneos SET ganador = $1, estado = 'finalizado' WHERE id_torneo = $2 AND ganador IS NULL`,
      [campeon.nombre_equipo, id_torneo]
    );
    await publicarResultadoTorneoEnMuro(id_torneo);
    return;
  }

  const rondaSiguiente = ronda_bracket + 1;
  const posicionSiguiente = Math.floor(posicion_bracket / 2);
  const esLocal = posicion_bracket % 2 === 0;
  const meta = { rama: partido.rama, categoria: partido.categoria, torneoNombre: partido.torneo_nombre };
  await colocarEnBracket(id_torneo, rondaSiguiente, posicionSiguiente, esLocal, ganador(partido), meta);
};

// Mismo molde que el post automático al subir un video de Academia (ver
// POST /api/academia-videos): inserta directo en comunicaciones con un tipo
// propio y un enlace débil (torneo_id) al origen. No hace nada si el torneo
// optó por no publicar, o si todavía no tiene ganador.
const publicarResultadoTorneoEnMuro = async (idTorneo) => {
  const torneo = (await pool.query('SELECT * FROM torneos WHERE id_torneo = $1', [idTorneo])).rows[0];
  if (!torneo || !torneo.publicar_resultado_en_muro || !torneo.ganador) return;
  await pool.query(
    `INSERT INTO comunicaciones (titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia, reacciones, asistencias, torneo_id)
     VALUES ($1, $2, 'Torneo', $3, $4, 'Baja', false, '{}', '[]', $5)`,
    [
      `🏆 ${torneo.nombre_torneo}: campeón ${torneo.ganador}`,
      `${torneo.ganador} se consagró campeón de "${torneo.nombre_torneo}".`,
      torneo.rama, torneo.categoria, idTorneo,
    ]
  );
};

// GET: equipos reales (nombre + logo) registrados para un torneo. Pública,
// mismo criterio que el resto de las rutas de lectura de torneos.
router.get('/api/torneos/:id/equipos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM torneo_equipos WHERE id_torneo = $1 ORDER BY nombre_equipo ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/torneos/:id/equipos]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: agregar/actualizar un equipo de un torneo. ON CONFLICT lo hace
// idempotente ante un doble submit del formulario.
router.post('/api/torneos/:id/equipos', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'torneos'), async (req, res) => {
  const { nombre_equipo, logo_url, id_club } = req.body;
  if (!String(nombre_equipo || '').trim()) {
    return res.status(400).json({ error: 'Falta el nombre del equipo.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO torneo_equipos (id_torneo, nombre_equipo, logo_url, id_club)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_torneo, nombre_equipo) DO UPDATE SET logo_url = EXCLUDED.logo_url, id_club = EXCLUDED.id_club
       RETURNING *`,
      [req.params.id, nombre_equipo.trim(), logo_url || null, id_club || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/torneos/:id/equipos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/torneos/:id/equipos/:idEquipo', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard', 'torneos'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM torneo_equipos WHERE id_equipo = $1 AND id_torneo = $2 RETURNING id_equipo`,
      [req.params.idEquipo, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado en este torneo.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/torneos/:id/equipos/:idEquipo]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: tabla de posiciones de un torneo, calculada desde los partidos
// finalizados asignados a él. Básquetbol no tiene empates: se ordena por
// victorias, luego % de victorias (por si no todos jugaron la misma
// cantidad de partidos), luego diferencia de puntos. Pública, igual que
// GET /api/torneos.
router.get('/api/torneos/:id/tabla-posiciones', async (req, res) => {
  try {
    const partidos = (await pool.query(
      `SELECT id_partido, equipo_local, equipo_visitante, pts_local, pts_visitante, fecha_hora, cancha_sede,
              logo_local_url, logo_visitante_url, ronda_bracket, posicion_bracket
       FROM partidos_live
       WHERE id_torneo = $1 AND estado_juego = 'finalizado'
       ORDER BY fecha_hora ASC`,
      [req.params.id]
    )).rows;

    const partidosPendientes = (await pool.query(
      `SELECT id_partido, equipo_local, equipo_visitante, fecha_hora, cancha_sede, estado_juego,
              logo_local_url, logo_visitante_url, ronda_bracket, posicion_bracket
       FROM partidos_live
       WHERE id_torneo = $1 AND estado_juego != 'finalizado'
       ORDER BY fecha_hora ASC`,
      [req.params.id]
    )).rows;

    const normalizar = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const tabla = new Map();
    const upsert = (nombre, pf, pc, resultado, logoUrl) => {
      const key = normalizar(nombre);
      if (!key) return;
      const fila = tabla.get(key) || { nombre: String(nombre || '').trim(), logoUrl: '', pj: 0, pg: 0, pp: 0, pf: 0, pc: 0 };
      fila.pj += 1;
      fila.pf += Number(pf) || 0;
      fila.pc += Number(pc) || 0;
      if (!fila.logoUrl && logoUrl) fila.logoUrl = logoUrl;
      if (resultado === 'W') fila.pg += 1;
      else if (resultado === 'L') fila.pp += 1;
      tabla.set(key, fila);
    };

    for (const p of partidos) {
      const ptsLocal = Number(p.pts_local) || 0;
      const ptsVisitante = Number(p.pts_visitante) || 0;
      const empate = ptsLocal === ptsVisitante;
      upsert(p.equipo_local, ptsLocal, ptsVisitante, empate ? null : (ptsLocal > ptsVisitante ? 'W' : 'L'), p.logo_local_url);
      upsert(p.equipo_visitante, ptsVisitante, ptsLocal, empate ? null : (ptsVisitante > ptsLocal ? 'W' : 'L'), p.logo_visitante_url);
    }

    const posiciones = [...tabla.values()]
      .map((fila) => ({ ...fila, dif: fila.pf - fila.pc, pct: fila.pj ? fila.pg / fila.pj : 0 }))
      .sort((a, b) => b.pg - a.pg || b.pct - a.pct || b.dif - a.dif)
      .map((fila, idx) => ({ ...fila, posicion: idx + 1 }));

    res.json({ posiciones, partidos, partidosPendientes });
  } catch (err) {
    console.error('[GET /api/torneos/:id/tabla-posiciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 30. ENDPOINTS: CLUBES (FASE 3)
// ==========================================

router.get('/api/clubes', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM clubes WHERE activo = true ORDER BY nombre_club ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/clubes]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/clubes', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const { nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club, logo_url, color_hex } = req.body;
  if (!String(nombre_club || '').trim()) {
    return res.status(400).json({ error: 'Falta el nombre del club.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO clubes (nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club, logo_url, color_hex, fecha_registro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
       RETURNING *`,
      [nombre_club, ciudad || null, rama || null, contacto_principal || null, telefono_contacto || null, email_club || null, logo_url || null, color_hex || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/clubes]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/clubes/:id_club', authenticate, requireAnyModule('scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const { nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club, logo_url, color_hex } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clubes SET
        nombre_club = COALESCE($1, nombre_club), ciudad = COALESCE($2, ciudad), rama = COALESCE($3, rama),
        contacto_principal = COALESCE($4, contacto_principal), telefono_contacto = COALESCE($5, telefono_contacto),
        email_club = COALESCE($6, email_club), logo_url = COALESCE($7, logo_url), color_hex = COALESCE($8, color_hex)
       WHERE id_club = $9 RETURNING *`,
      [nombre_club || null, ciudad || null, rama || null, contacto_principal || null, telefono_contacto || null, email_club || null, logo_url || null, color_hex || null, req.params.id_club]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Club no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/clubes/:id_club]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
