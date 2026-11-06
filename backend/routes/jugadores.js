// Rutas de jugadores: fichas, fotos, colección de tarjetas, ausencias, visitas, lesiones, disciplina, evaluaciones, gamificación y marcas.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const path = require('path');
const { authenticate, normalizarRutParaComparar, requireModule, requireApoderadoDeJugadorOModule, stripFieldsUnlessModule, hashPassword, requireAnyModule, resolverPermisosDeActor, requireRole } = require('../security/auth');
const { normalizarRol } = require('../security/accessControl');
const { pool } = require('../lib/db');
const { calcularNivelDesdeXPTotal } = require('../lib/gamificacion');
const { ROLES_JUGADORES_ACOTADOS, actorPuedeVerJugador, obtenerPupilosDeActor } = require('../lib/actores');
const { construirCorreoPlaceholderDesdeRut, obtenerColumnasTabla, obtenerCuentaPorRutNormalizado } = require('../lib/cuentas');
const { formatearRut, normalizarRut } = require('../lib/rut');
const { uploadLogoMemoria } = require('../lib/uploads');
const { quoteIdent } = require('../lib/auditoria');

const router = express.Router();

// ==========================================
// 9. ENDPOINTS: JUGADORES (FASE 1)
// ==========================================

// GET: Todos los jugadores
// Sin gate de módulo: casi todos los roles reales (jugador/apoderado vía
// bootstrap para resolver su propio pupilo, staff, mesa para el roster en
// vivo, admin) necesitan esta lista hoy. Solo se exige sesión válida.
// Antes devolvía el roster completo a cualquier cuenta autenticada (un
// apoderado o socio podía traerse los datos de TODOS los deportistas del
// club, no solo los suyos, llamando la API directo). Staff/admin/super_admin
// y cualquier otro rol no listado en ROLES_JUGADORES_ACOTADOS siguen viendo
// todo, igual que hoy.
router.get('/api/jugadores', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, COALESCE(SUM(gp.puntos_obtenidos), 0) AS xp_total
       FROM jugadores j
       LEFT JOIN gamificacion_puntos gp ON gp.rut_jugador = j.rut_jugador
       GROUP BY j.rut_jugador
       ORDER BY j.apellido_paterno ASC`
    );
    // password_jugador es una columna legada (clave en texto plano, sin uso en
    // el frontend): nunca se devuelve.
    const filas = result.rows.map(({ password_jugador: _omitida, ...j }) => ({ ...j, xp_total: Number(j.xp_total), nivel_actual: calcularNivelDesdeXPTotal(j.xp_total) }));
    if (!ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(req.actor.rol))) {
      return res.json(filas);
    }
    const pupilos = await obtenerPupilosDeActor(req.actor);
    const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
    res.json(filas.filter((j) => rutsPupilos.has(normalizarRutParaComparar(j.rut_jugador))));
  } catch (err) {
    console.error('[GET /api/jugadores]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Jugador por RUT — mismo criterio de acotamiento que la lista de arriba.
router.get('/api/jugadores/:rut', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, COALESCE(SUM(gp.puntos_obtenidos), 0) AS xp_total
       FROM jugadores j
       LEFT JOIN gamificacion_puntos gp ON gp.rut_jugador = j.rut_jugador
       WHERE j.rut_jugador = $1
       GROUP BY j.rut_jugador`,
      [req.params.rut]
    );
    const jugador = result.rows[0];
    if (!jugador) return res.json({});
    delete jugador.password_jugador;
    jugador.xp_total = Number(jugador.xp_total);
    jugador.nivel_actual = calcularNivelDesdeXPTotal(jugador.xp_total);

    if (ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(req.actor.rol))) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
      if (!rutsPupilos.has(normalizarRutParaComparar(jugador.rut_jugador))) {
        return res.status(403).json({ error: 'No tienes acceso a este deportista.' });
      }
    }
    res.json(jugador);
  } catch (err) {
    console.error('[GET /api/jugadores/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear jugador
router.post('/api/jugadores', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const {
    rut_jugador,
    nombres,
    apellido_paterno,
    apellido_materno,
    rama,
    categoria,
    correo_apoderado,
    foto_jugador,
  } = req.body;
  try {
    const columnasJugadores = await obtenerColumnasTabla('jugadores');
    const columnas = ['rut_jugador', 'nombres', 'apellido_paterno', 'apellido_materno', 'rama', 'categoria', 'correo_apoderado', 'estado'];
    const valores = [rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, correo_apoderado, 'activo'];

    if (foto_jugador !== undefined && columnasJugadores.has('foto_jugador')) {
      columnas.push('foto_jugador');
      valores.push(foto_jugador);
    }

    const placeholders = columnas.map((_columna, indice) => `$${indice + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO jugadores (${columnas.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      valores
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/jugadores]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar jugador por RUT
const CAMPOS_JUGADOR_SOLO_ADMIN = [
  'rut_apoderado', 'correo_apoderado', 'correo_jugador', 'password_jugador', 'forzar_clave_jugador',
  'rama', 'categoria', 'numero_camiseta', 'fecha_ingreso', 'mes_inicio_cobro', 'beca', 'exento_mensualidad',
  'valor_mensualidad', 'matricula_pagada', 'polera_entregada', 'poleron_entregado',
  'estado', 'estado_deportivo', 'fecha_inicio_baja', 'fecha_fin_baja', 'xp_puntos',
];

// El apoderado dueño (rut_apoderado registrado) puede editar el perfil de su propio
// pupilo (datos personales, salud, contacto, tallas); los campos administrativos
// (categoría, mensualidad, beca, vínculo de cuenta, etc.) quedan reservados a admin.
router.put('/api/jugadores/:rut', authenticate, requireApoderadoDeJugadorOModule(pool, 'admin_dashboard', { permitirPropioJugador: true }), stripFieldsUnlessModule(CAMPOS_JUGADOR_SOLO_ADMIN, 'admin_dashboard'), async (req, res) => {
  const {
    rut_apoderado,
    correo_apoderado,
    correo_jugador,
    password_jugador,
    forzar_clave_jugador,
    parentesco_apoderado,
    nombres,
    apellido_paterno,
    apellido_materno,
    fecha_nacimiento,
    año_nacimiento,
    colegio,
    rama,
    categoria,
    posicion_de_juego,
    estatura,
    peso,
    mano_habil,
    numero_camiseta,
    club_anterior,
    fecha_ingreso,
    mes_inicio_cobro,
    beca,
    valor_mensualidad,
    matricula_pagada,
    talla_camiseta,
    talla_short,
    polera_entregada,
    poleron_entregado,
    derechos_imagen,
    prevision,
    tipo_sangre,
    alergias,
    nombre_emergencia,
    parentesco_emergencia,
    num_emergencia,
    estado,
    foto_jugador,
    estado_deportivo,
    fecha_inicio_baja,
    fecha_fin_baja,
    xp_puntos,
    diseno_marco,
    exento_mensualidad,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE jugadores SET
        correo_apoderado = COALESCE($1, correo_apoderado),
        correo_jugador = COALESCE($2, correo_jugador),
        password_jugador = COALESCE($3, password_jugador),
        forzar_clave_jugador = COALESCE($4, forzar_clave_jugador),
        parentesco_apoderado = COALESCE($5, parentesco_apoderado),
        nombres = COALESCE($6, nombres),
        apellido_paterno = COALESCE($7, apellido_paterno),
        apellido_materno = COALESCE($8, apellido_materno),
        fecha_nacimiento = COALESCE($9, fecha_nacimiento),
        año_nacimiento = COALESCE($10, año_nacimiento),
        colegio = COALESCE($11, colegio),
        rama = COALESCE($12, rama),
        categoria = COALESCE($13, categoria),
        posicion_de_juego = COALESCE($14, posicion_de_juego),
        estatura = COALESCE($15, estatura),
        peso = COALESCE($16, peso),
        mano_habil = COALESCE($17, mano_habil),
        numero_camiseta = COALESCE($18, numero_camiseta),
        club_anterior = COALESCE($19, club_anterior),
        fecha_ingreso = COALESCE($20, fecha_ingreso),
        mes_inicio_cobro = COALESCE($21, mes_inicio_cobro),
        beca = COALESCE($22, beca),
        valor_mensualidad = COALESCE($23, valor_mensualidad),
        matricula_pagada = COALESCE($24, matricula_pagada),
        talla_camiseta = COALESCE($25, talla_camiseta),
        talla_short = COALESCE($26, talla_short),
        polera_entregada = COALESCE($27, polera_entregada),
        poleron_entregado = COALESCE($28, poleron_entregado),
        derechos_imagen = COALESCE($29, derechos_imagen),
        prevision = COALESCE($30, prevision),
        tipo_sangre = COALESCE($31, tipo_sangre),
        alergias = COALESCE($32, alergias),
        nombre_emergencia = COALESCE($33, nombre_emergencia),
        parentesco_emergencia = COALESCE($34, parentesco_emergencia),
        num_emergencia = COALESCE($35, num_emergencia),
        estado = COALESCE($36, estado),
        foto_jugador = COALESCE($37, foto_jugador),
        estado_deportivo = COALESCE($38, estado_deportivo),
        fecha_inicio_baja = COALESCE($39, fecha_inicio_baja),
        fecha_fin_baja = COALESCE($40, fecha_fin_baja),
        xp_puntos = COALESCE($41, xp_puntos),
        rut_apoderado = COALESCE($42, rut_apoderado),
        diseno_marco = COALESCE($43, diseno_marco),
        exento_mensualidad = COALESCE($44, exento_mensualidad),
        updated_at = NOW()
      WHERE rut_jugador = $45
      RETURNING *`,
      [
        correo_apoderado ?? null,
        correo_jugador ?? null,
        password_jugador ?? null,
        forzar_clave_jugador ?? null,
        parentesco_apoderado ?? null,
        nombres ?? null,
        apellido_paterno ?? null,
        apellido_materno ?? null,
        fecha_nacimiento ?? null,
        año_nacimiento ?? null,
        colegio ?? null,
        rama ?? null,
        categoria ?? null,
        posicion_de_juego ?? null,
        estatura ?? null,
        peso ?? null,
        mano_habil ?? null,
        numero_camiseta ?? null,
        club_anterior ?? null,
        fecha_ingreso ?? null,
        mes_inicio_cobro ?? null,
        beca ?? null,
        valor_mensualidad ?? null,
        matricula_pagada ?? null,
        talla_camiseta ?? null,
        talla_short ?? null,
        polera_entregada ?? null,
        poleron_entregado ?? null,
        derechos_imagen ?? null,
        prevision ?? null,
        tipo_sangre ?? null,
        alergias ?? null,
        nombre_emergencia ?? null,
        parentesco_emergencia ?? null,
        num_emergencia ?? null,
        estado ?? null,
        foto_jugador ?? null,
        estado_deportivo ?? null,
        fecha_inicio_baja ?? null,
        fecha_fin_baja ?? null,
        xp_puntos ?? null,
        rut_apoderado ?? null,
        diseno_marco ?? null,
        exento_mensualidad ?? null,
        req.params.rut,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/jugadores/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: marca/desmarca a un deportista como "autogestionable" (puede pagar
// su propia cuota, ve 'Mi Cuenta' y su Tesorería propia) — pedido explícito
// del club para deportistas mayores que no dependen de su apoderado para
// pagar. Técnicamente esto ya funcionaba con solo dar el permiso 'perfil'
// vía el override de la cuenta (mismo mecanismo que Ajustes > Permisos), acá
// se expone directo desde la ficha del deportista para no obligar al admin a
// buscar la cuenta en la matriz completa. Si el deportista todavía no tiene
// cuenta propia (nunca inició sesión), se crea una mínima con la clave
// universal '12345' ya hasheada — el mismo bootstrap que login ya soporta.
router.post('/api/jugadores/:rut/autogestionable', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const rutNormalizado = normalizarRutParaComparar(req.params.rut);
  const activo = Boolean(req.body?.activo);

  try {
    const jugadorRes = await pool.query(
      `SELECT rut_jugador, nombres, apellido_paterno, estado
       FROM jugadores
       WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1
       LIMIT 1`,
      [rutNormalizado]
    );
    if (jugadorRes.rows.length === 0) {
      return res.status(404).json({ error: 'No existe ningún deportista con ese RUT.' });
    }
    const jugador = jugadorRes.rows[0];

    let cuenta = await obtenerCuentaPorRutNormalizado(rutNormalizado);
    if (!cuenta) {
      const rutFormateado = formatearRut(jugador.rut_jugador || rutNormalizado);
      const correoPlaceholder = construirCorreoPlaceholderDesdeRut(rutNormalizado);
      const passwordHashDefault = await hashPassword('12345');
      await pool.query(
        `INSERT INTO cuentas (correo, rut, password, nombres, apellido_paterno, rol, perfil_principal, estado, forzar_clave, permisos_override)
         VALUES ($1, $2, $3, $4, $5, 'jugador', 'jugador', 'activo', true, '{}'::jsonb)`,
        [correoPlaceholder, rutFormateado, passwordHashDefault, jugador.nombres || null, jugador.apellido_paterno || null]
      );
      cuenta = await obtenerCuentaPorRutNormalizado(rutNormalizado);
    }

    const overrideActual = (cuenta.permisos_override && typeof cuenta.permisos_override === 'object') ? cuenta.permisos_override : {};
    const nuevoOverride = { ...overrideActual, perfil: activo };

    const actualizada = await pool.query(
      `UPDATE cuentas SET permisos_override = $1::jsonb, updated_at = NOW() WHERE id = $2
       RETURNING id, rut, rol, permisos_override`,
      [JSON.stringify(nuevoOverride), cuenta.id]
    );

    res.json(actualizada.rows[0]);
  } catch (err) {
    console.error('[POST /api/jugadores/:rut/autogestionable]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: el apoderado dueño del jugador (o admin) sube la foto de PERFIL
// general del deportista (foto_jugador) — la que se usa en el avatar del
// header, Tesoreria, Tarjeta Oficial CCF, etc. Reutiliza el almacenamiento
// de logo_assets (misma tabla BYTEA que ya sirve logos) en vez de crear
// otra tabla para lo mismo. Distinta de /foto-tarjeta (ver mas abajo).
router.post('/api/jugadores/:rut/foto', authenticate, requireApoderadoDeJugadorOModule(pool, 'admin_dashboard', { permitirPropioJugador: true }), uploadLogoMemoria.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar una foto.' });
    }

    const rut = String(req.params.rut || '').trim();
    const extension = path.extname(req.file.originalname).toLowerCase() || '.png';
    const filename = `foto-jugador-${normalizarRutParaComparar(rut)}-${Date.now()}${extension}`;

    await pool.query(
      `INSERT INTO logo_assets (nombre, tipo, filename, mime_type, file_data)
       VALUES ($1, 'foto-jugador', $2, $3, $4)`,
      [`Foto ${rut}`, filename, req.file.mimetype, req.file.buffer]
    );

    const urlFoto = `/api/logo-assets/file/${encodeURIComponent(filename)}`;
    const result = await pool.query(
      `UPDATE jugadores SET foto_jugador = $1, updated_at = NOW() WHERE rut_jugador = $2 RETURNING *`,
      [urlFoto, rut]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[POST /api/jugadores/:rut/foto]', error);
    return res.status(500).json({ error: error.message || 'No se pudo subir la foto.' });
  }
});

// POST: foto SOLO para la tarjeta coleccionable (foto_tarjeta_coleccion) —
// campo separado de foto_jugador a pedido explicito del usuario: subir una
// foto para la tarjeta no debe cambiar la foto de perfil general.
router.post('/api/jugadores/:rut/foto-tarjeta', authenticate, requireApoderadoDeJugadorOModule(pool, 'admin_dashboard', { permitirPropioJugador: true }), uploadLogoMemoria.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar una foto.' });
    }

    const rut = String(req.params.rut || '').trim();
    const extension = path.extname(req.file.originalname).toLowerCase() || '.png';
    const filename = `foto-tarjeta-${normalizarRutParaComparar(rut)}-${Date.now()}${extension}`;

    await pool.query(
      `INSERT INTO logo_assets (nombre, tipo, filename, mime_type, file_data)
       VALUES ($1, 'foto-tarjeta-coleccion', $2, $3, $4)`,
      [`Foto tarjeta ${rut}`, filename, req.file.mimetype, req.file.buffer]
    );

    const urlFoto = `/api/logo-assets/file/${encodeURIComponent(filename)}`;
    const result = await pool.query(
      `UPDATE jugadores SET foto_tarjeta_coleccion = $1, updated_at = NOW() WHERE rut_jugador = $2 RETURNING *`,
      [urlFoto, rut]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[POST /api/jugadores/:rut/foto-tarjeta]', error);
    return res.status(500).json({ error: error.message || 'No se pudo subir la foto.' });
  }
});

// POST: agrega la tarjeta de otro jugador (rut_objetivo) al álbum de :rut,
// escaneada desde el QR de colección de la tarjeta ajena. ON CONFLICT DO
// NOTHING porque volver a escanear una tarjeta ya coleccionada no es un
// error — simplemente no suma una segunda vez.
router.post('/api/jugadores/:rut/coleccion', authenticate, requireApoderadoDeJugadorOModule(pool, 'admin_dashboard', { permitirPropioJugador: true }), async (req, res) => {
  try {
    const rutColeccionista = String(req.params.rut || '').trim();
    const rutObjetivo = String(req.body?.rut_objetivo || '').trim();

    if (!rutObjetivo) {
      return res.status(400).json({ error: 'Falta el rut de la tarjeta a coleccionar.' });
    }
    if (normalizarRutParaComparar(rutColeccionista) === normalizarRutParaComparar(rutObjetivo)) {
      return res.status(400).json({ error: 'No puedes coleccionar tu propia tarjeta.' });
    }

    const jugadorObjetivo = await pool.query(
      `SELECT rut_jugador, nombres, apellido_paterno, apellido_materno FROM jugadores WHERE rut_jugador = $1`,
      [rutObjetivo]
    );
    if (jugadorObjetivo.rows.length === 0) {
      return res.status(404).json({ error: 'Esa tarjeta no corresponde a ningún jugador del club.' });
    }

    const insertado = await pool.query(
      `INSERT INTO tarjetas_coleccionadas (rut_coleccionista, rut_coleccionado)
       VALUES ($1, $2)
       ON CONFLICT (rut_coleccionista, rut_coleccionado) DO NOTHING
       RETURNING id`,
      [rutColeccionista, rutObjetivo]
    );

    const nombreObjetivo = `${jugadorObjetivo.rows[0].nombres || ''} ${jugadorObjetivo.rows[0].apellido_paterno || ''}`.trim();
    return res.json({
      ok: true,
      nueva: insertado.rows.length > 0,
      nombre: nombreObjetivo,
    });
  } catch (error) {
    console.error('[POST /api/jugadores/:rut/coleccion]', error);
    return res.status(500).json({ error: error.message || 'No se pudo agregar la tarjeta.' });
  }
});

// GET: álbum de tarjetas coleccionadas por :rut, con nivel calculado igual
// que el resto de la app (xp_total real vía gamificacion_puntos, no un campo
// estático) para que el marco de cada mini-tarjeta coleccionada muestre la
// rareza correcta. total_club: cuántos jugadores activos hay para coleccionar
// en total (para el progreso "X/Y"), sin exponer el roster completo.
router.get('/api/jugadores/:rut/coleccion', authenticate, requireApoderadoDeJugadorOModule(pool, 'admin_dashboard', { permitirPropioJugador: true }), async (req, res) => {
  try {
    const rutColeccionista = String(req.params.rut || '').trim();

    const coleccion = await pool.query(
      `SELECT j.rut_jugador, j.nombres, j.apellido_paterno, j.apellido_materno, j.foto_jugador,
              j.foto_tarjeta_coleccion, j.diseno_marco, j.posicion_de_juego, j.estatura,
              j.año_nacimiento, j.categoria, j.rama, j.numero_camiseta,
              COALESCE(SUM(gp.puntos_obtenidos), 0) AS xp_total,
              tc.fecha_coleccion
       FROM tarjetas_coleccionadas tc
       JOIN jugadores j ON j.rut_jugador = tc.rut_coleccionado
       LEFT JOIN gamificacion_puntos gp ON gp.rut_jugador = j.rut_jugador
       WHERE tc.rut_coleccionista = $1
       GROUP BY j.rut_jugador, j.nombres, j.apellido_paterno, j.apellido_materno, j.foto_jugador,
                j.foto_tarjeta_coleccion, j.diseno_marco, j.posicion_de_juego, j.estatura,
                j.año_nacimiento, j.categoria, j.rama, j.numero_camiseta, tc.fecha_coleccion
       ORDER BY tc.fecha_coleccion DESC`,
      [rutColeccionista]
    );

    const totalClub = await pool.query(
      // UPPER(): datos importados desde Google Sheets guardan "ACTIVO" en
      // mayúscula, mientras el resto de la app escribe "activo" — sin esto
      // el conteo daba 0 aunque hubiera cientos de jugadores activos.
      `SELECT COUNT(*) AS total FROM jugadores WHERE UPPER(estado) = 'ACTIVO' AND rut_jugador != $1`,
      [rutColeccionista]
    );

    const items = coleccion.rows.map((fila) => ({
      ...fila,
      xp_total: Number(fila.xp_total),
      nivel: calcularNivelDesdeXPTotal(fila.xp_total),
    }));

    return res.json({ items, total_club: Number(totalClub.rows[0]?.total || 0) });
  } catch (error) {
    console.error('[GET /api/jugadores/:rut/coleccion]', error);
    return res.status(500).json({ error: error.message || 'No se pudo cargar el álbum.' });
  }
});

// POST: reporta una ausencia prolongada (motivo + período obligatorio). Solo
// el apoderado del jugador o admin/superadmin — igual que el resto de
// /api/jugadores/:rut/*. Mientras la fecha de hoy caiga dentro del período,
// GET /api/ausencias/activas la va a devolver, y de ahí Pasar Lista y
// Citaciones la usan para bloquear/avisar.
router.post('/api/jugadores/:rut/ausencias', authenticate, requireApoderadoDeJugadorOModule(pool, 'admin_dashboard', { permitirPropioJugador: true }), async (req, res) => {
  try {
    const rutJugador = String(req.params.rut || '').trim();
    const motivo = String(req.body?.motivo || '').trim();
    const fechaInicio = String(req.body?.fecha_inicio || '').trim();
    const fechaFin = String(req.body?.fecha_fin || '').trim();

    if (!motivo) return res.status(400).json({ error: 'Falta el motivo de la ausencia.' });
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'Falta el período (fecha de inicio y fin).' });
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      return res.status(400).json({ error: 'La fecha de término no puede ser anterior a la de inicio.' });
    }

    const nombreReporta = `${req.actor.nombres || ''} ${req.actor.apellido_paterno || ''}`.trim() || req.actor.correo || req.actor.rut;

    const result = await pool.query(
      `INSERT INTO ausencias_jugador (rut_jugador, motivo, fecha_inicio, fecha_fin, reportado_por_rut, reportado_por_nombre)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [rutJugador, motivo, fechaInicio, fechaFin, req.actor.rut || null, nombreReporta]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[POST /api/jugadores/:rut/ausencias]', error);
    return res.status(500).json({ error: error.message || 'No se pudo registrar la ausencia.' });
  }
});

// GET: historial de ausencias de UN jugador (para mostrar en su ficha/tarjeta).
router.get('/api/jugadores/:rut/ausencias', authenticate, requireApoderadoDeJugadorOModule(pool, ['admin_dashboard', 'asistencia_staff'], { permitirPropioJugador: true }), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ausencias_jugador WHERE rut_jugador = $1 ORDER BY fecha_inicio DESC`,
      [String(req.params.rut || '').trim()]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('[GET /api/jugadores/:rut/ausencias]', error);
    return res.status(500).json({ error: error.message || 'No se pudo obtener el historial de ausencias.' });
  }
});

// GET: TODAS las ausencias vigentes hoy (fecha_inicio <= hoy <= fecha_fin),
// con datos del jugador — lo consumen Pasar Lista y Citaciones para saber a
// quién bloquear/avisar sin tener que consultar jugador por jugador.
router.get('/api/ausencias/activas', authenticate, requireAnyModule('admin_dashboard', 'asistencia_staff', 'citaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria
       FROM ausencias_jugador a
       JOIN jugadores j ON j.rut_jugador = a.rut_jugador
       WHERE CURRENT_DATE BETWEEN a.fecha_inicio AND a.fecha_fin
       ORDER BY a.fecha_fin ASC`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('[GET /api/ausencias/activas]', error);
    return res.status(500).json({ error: error.message || 'No se pudo obtener las ausencias vigentes.' });
  }
});

// POST: confirma que la jugadora ya está apta para volver a jugar. Paso
// OPCIONAL del staff/DT — no condiciona el des-bloqueo, que ya pasa solo con
// que la fecha_fin haya quedado atrás; esto es solo para dejar constancia.
router.post('/api/ausencias/:id/confirmar-regreso', authenticate, requireAnyModule('admin_dashboard', 'asistencia_staff'), async (req, res) => {
  try {
    const nombreConfirma = `${req.actor.nombres || ''} ${req.actor.apellido_paterno || ''}`.trim() || req.actor.correo || req.actor.rut;
    const result = await pool.query(
      `UPDATE ausencias_jugador
       SET confirmada_vuelta = true, fecha_confirmacion = NOW(), confirmada_por_nombre = $1
       WHERE id = $2
       RETURNING *`,
      [nombreConfirma, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ausencia no encontrada.' });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[POST /api/ausencias/:id/confirmar-regreso]', error);
    return res.status(500).json({ error: error.message || 'No se pudo confirmar el regreso.' });
  }
});

// DELETE: cancela un reporte de ausencia (ej. error de fecha) — solo quien
// la reportó o admin/superadmin, mismo criterio que editar un video de
// Academia (PUT /api/academia-videos/:id, ver más arriba).
router.delete('/api/ausencias/:id', authenticate, async (req, res) => {
  try {
    const existente = await pool.query('SELECT reportado_por_rut FROM ausencias_jugador WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) return res.status(404).json({ error: 'Ausencia no encontrada.' });

    const permisos = await resolverPermisosDeActor(req.actor);
    if (!permisos.admin_dashboard) {
      const rutReporto = normalizarRutParaComparar(existente.rows[0].reportado_por_rut || '');
      if (!rutReporto || rutReporto !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes cancelar una ausencia reportada por otra persona.' });
      }
    }

    await pool.query('DELETE FROM ausencias_jugador WHERE id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/ausencias/:id]', error);
    return res.status(500).json({ error: error.message || 'No se pudo cancelar la ausencia.' });
  }
});

// DELETE: Borrar jugador definitivamente (solo super admin)
router.delete('/api/jugadores/:rut', authenticate, requireRole('super_admin'), async (req, res) => {
  const actor = req.actor;

  const rutObjetivoNormalizado = normalizarRut(req.params.rut || '');
  if (!rutObjetivoNormalizado) {
    return res.status(400).json({ error: 'RUT de jugador inválido.' });
  }

  if (actor.rut && normalizarRut(actor.rut) === rutObjetivoNormalizado) {
    return res.status(400).json({ error: 'No puedes borrar tu propio registro por RUT.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jugadorRes = await client.query(
      `SELECT rut_jugador
       FROM jugadores
       WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1
       LIMIT 1`,
      [rutObjetivoNormalizado]
    );

    if (jugadorRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }

    const cleanupTables = await client.query(
      `SELECT table_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name IN ('rut_jugador', 'rut_pagos')
         AND table_name <> 'jugadores'
       GROUP BY table_name
       ORDER BY table_name ASC`
    );

    const resumenEliminados = {};
    for (const row of cleanupTables.rows) {
      const tableName = String(row.table_name || '').trim();
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) continue;

      const columnsRes = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name IN ('rut_jugador', 'rut_pagos')`,
        [tableName]
      );

      const tieneRutJugador = columnsRes.rows.some((col) => col.column_name === 'rut_jugador');
      const tieneRutPagos = columnsRes.rows.some((col) => col.column_name === 'rut_pagos');
      if (!tieneRutJugador && !tieneRutPagos) continue;

      const condiciones = [];
      if (tieneRutJugador) {
        condiciones.push(`UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1`);
      }
      if (tieneRutPagos) {
        condiciones.push(`UPPER(REPLACE(REPLACE(COALESCE(rut_pagos, ''), '.', ''), '-', '')) = $1`);
      }

      const sql = `DELETE FROM ${quoteIdent(tableName)} WHERE ${condiciones.join(' OR ')}`;
      const deletedRes = await client.query(sql, [rutObjetivoNormalizado]);
      if ((deletedRes.rowCount || 0) > 0) {
        resumenEliminados[tableName] = deletedRes.rowCount;
      }
    }

    const deletedJugador = await client.query(
      `DELETE FROM jugadores
       WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1`,
      [rutObjetivoNormalizado]
    );

    if ((deletedJugador.rowCount || 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }

    await client.query('COMMIT');
    return res.json({
      ok: true,
      message: 'Jugador eliminado definitivamente.',
      deleted: { rut: rutObjetivoNormalizado },
      cleanup: resumenEliminados,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignorar errores secundarios de rollback.
    }
    console.error('[DELETE /api/jugadores/:rut]', err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 16. ENDPOINTS: EVALUACIONES (FASE 2)
// ==========================================

// GET: Evaluaciones de un jugador. Staff/admin/superadmin ven cualquiera;
// el resto (apoderado, jugador, socio, etc.) solo puede ver las de sus
// propios pupilos — antes cualquiera con el módulo 'jugador' podía leer las
// evaluaciones de CUALQUIER rut solo cambiando el parámetro de la URL.
router.get('/api/evaluaciones/jugador/:rut', authenticate, requireAnyModule('evaluacion_staff', 'jugador'), async (req, res) => {
  try {
    if (ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(req.actor.rol))) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      if (!pupilos.some((p) => normalizarRutParaComparar(p.rut_jugador) === normalizarRutParaComparar(req.params.rut))) {
        return res.status(403).json({ error: 'No tienes acceso a las evaluaciones de ese deportista.' });
      }
    }
    const result = await pool.query(
      `SELECT * FROM evaluaciones WHERE rut_jugador = $1 ORDER BY fecha_evaluacion DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/evaluaciones/jugador/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear evaluación
router.post('/api/evaluaciones', authenticate, requireModule('evaluacion_staff'), async (req, res) => {
  const {
    rut_jugador, evaluador_rut, tipo_evaluacion,
    puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental,
    puntaje_coordinacion, puntaje_coordinacion_ocular, puntaje_equilibrio, puntaje_orientacion, lateralidad,
    comentarios, recomendaciones,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO evaluaciones (
         rut_jugador, evaluador_rut, fecha_evaluacion, tipo_evaluacion,
         puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental,
         puntaje_coordinacion, puntaje_coordinacion_ocular, puntaje_equilibrio, puntaje_orientacion, lateralidad,
         comentarios, recomendaciones
       )
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        rut_jugador, evaluador_rut, tipo_evaluacion,
        puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental,
        puntaje_coordinacion, puntaje_coordinacion_ocular, puntaje_equilibrio, puntaje_orientacion, lateralidad || null,
        comentarios, recomendaciones,
      ]
    );
    res.json(result.rows[0]);

    // XP real por evaluación completada (deportiva o psicomotriz) — mismo
    // criterio que la asistencia: no bloquea la respuesta si falla.
    if (rut_jugador) {
      try {
        await pool.query(
          `INSERT INTO gamificacion_puntos (rut_jugador, tipo_logro, puntos_obtenidos, descripcion)
           VALUES ($1, 'evaluacion_completada', 30, $2)`,
          [rut_jugador, `Evaluación ${tipo_evaluacion || 'deportiva'} completada`]
        );
      } catch (xpErr) {
        console.error('[POST /api/evaluaciones] error sumando XP de evaluación:', xpErr.message);
      }
    }
  } catch (err) {
    console.error('[POST /api/evaluaciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 17. ENDPOINTS: GAMIFICACIÓN (FASE 2)
// ==========================================

// GET: Puntos de un jugador
router.get('/api/gamificacion/:rut', authenticate, requireModule('jugador'), async (req, res) => {
  try {
    if (!(await actorPuedeVerJugador(req.actor, req.params.rut))) {
      return res.status(403).json({ error: 'No tienes acceso a este deportista.' });
    }
    const result = await pool.query(
      `SELECT * FROM gamificacion_puntos WHERE rut_jugador = $1 ORDER BY fecha_logro DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/gamificacion/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear logro/puntos
router.post('/api/gamificacion', authenticate, requireAnyModule('evaluacion_staff', 'scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const { rut_jugador, tipo_logro, puntos_obtenidos, descripcion } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO gamificacion_puntos (rut_jugador, tipo_logro, puntos_obtenidos, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [rut_jugador, tipo_logro, puntos_obtenidos, descripcion]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/gamificacion]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 18. ENDPOINTS: MARCAS/RÉCORDS (FASE 2)
// ==========================================

// GET: Marcas de un jugador
router.get('/api/marcas/:rut', authenticate, requireModule('jugador'), async (req, res) => {
  try {
    if (!(await actorPuedeVerJugador(req.actor, req.params.rut))) {
      return res.status(403).json({ error: 'No tienes acceso a este deportista.' });
    }
    const result = await pool.query(
      `SELECT * FROM marcas_tiempo WHERE rut_jugador = $1 ORDER BY fecha_marca DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/marcas/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Registrar marca
router.post('/api/marcas', authenticate, requireAnyModule('evaluacion_staff', 'scoreboard_live', 'admin_dashboard'), async (req, res) => {
  const { rut_jugador, categoria, tipo_marca, valor_marca, unidad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO marcas_tiempo (rut_jugador, categoria, tipo_marca, valor_marca, unidad, fecha_marca)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       RETURNING *`,
      [rut_jugador, categoria, tipo_marca, valor_marca, unidad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/marcas]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 23. ENDPOINTS: JUGADORES VISITA (FASE 2)
// ==========================================

// GET: Jugadores en visita/prueba
router.get('/api/jugadores-visita', authenticate, requireModule('invitados'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jugadores_visita ORDER BY fecha_visita DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/jugadores-visita]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Registrar jugador en visita
router.post('/api/jugadores-visita', authenticate, requireModule('invitados'), async (req, res) => {
  const {
    rut_visita,
    nombres,
    apellido_paterno,
    apellido_materno,
    club_procedencia,
    rama,
    categoria,
    posicion,
    contacto_apoderado,
    telefono_contacto,
    club_logo_url,
    foto_jugador,
  } = req.body;
  try {
    const columnasVisita = await obtenerColumnasTabla('jugadores_visita');
    const columnas = ['rut_visita', 'nombres', 'apellido_paterno', 'apellido_materno', 'club_procedencia', 'rama', 'categoria', 'posicion', 'contacto_apoderado', 'telefono_contacto', 'fecha_visita'];
    const valores = [rut_visita, nombres, apellido_paterno, apellido_materno, club_procedencia, rama, categoria, posicion, contacto_apoderado, telefono_contacto];

    if (club_logo_url !== undefined && columnasVisita.has('club_logo_url')) {
      columnas.splice(columnas.length - 1, 0, 'club_logo_url');
      valores.push(club_logo_url);
    } else if (foto_jugador !== undefined && columnasVisita.has('foto_jugador')) {
      columnas.splice(columnas.length - 1, 0, 'foto_jugador');
      valores.push(foto_jugador);
    }

    const placeholders = columnas.slice(0, -1).map((_columna, indice) => `$${indice + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO jugadores_visita (${columnas.join(', ')})
       VALUES (${placeholders}, CURRENT_DATE)
       RETURNING *`,
      valores
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/jugadores-visita]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar resultado de prueba
router.put('/api/jugadores-visita/:id', authenticate, requireModule('invitados'), async (req, res) => {
  const { prueba_realizada, resultado_prueba, reclutado, observaciones, club_logo_url, foto_jugador } = req.body;
  try {
    const columnasVisita = await obtenerColumnasTabla('jugadores_visita');
    const sets = [
      'prueba_realizada = $1',
      'resultado_prueba = $2',
      'reclutado = $3',
      'observaciones = $4',
    ];
    const valores = [prueba_realizada, resultado_prueba, reclutado, observaciones];

    if (club_logo_url !== undefined && columnasVisita.has('club_logo_url')) {
      sets.push(`club_logo_url = $${valores.length + 1}`);
      valores.push(club_logo_url);
    } else if (foto_jugador !== undefined && columnasVisita.has('foto_jugador')) {
      sets.push(`foto_jugador = $${valores.length + 1}`);
      valores.push(foto_jugador);
    }

    sets.push(`updated_at = NOW()`);
    valores.push(req.params.id);

    const result = await pool.query(
      `UPDATE jugadores_visita 
       SET ${sets.join(', ')}
       WHERE id_visita = $${valores.length}
       RETURNING *`,
      valores
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/jugadores-visita/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 31. ENDPOINTS: LESIONES (FASE 3)
// ==========================================

router.get('/api/lesiones', authenticate, requireAnyModule('evaluacion_staff', 'asistencia_staff'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, j.nombres, j.apellido_paterno
       FROM lesiones l
       LEFT JOIN jugadores j ON l.rut_jugador = j.rut_jugador
       ORDER BY l.fecha_lesion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/lesiones]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/lesiones', authenticate, requireAnyModule('evaluacion_staff', 'asistencia_staff'), async (req, res) => {
  const { rut_jugador, tipo_lesion, descripcion, fecha_recuperacion_estimada, medico_tratante } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO lesiones (rut_jugador, tipo_lesion, descripcion, fecha_lesion, fecha_recuperacion_estimada, medico_tratante, estado_lesion)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'activa')
       RETURNING *`,
      [rut_jugador, tipo_lesion, descripcion, fecha_recuperacion_estimada, medico_tratante]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/lesiones]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 32. ENDPOINTS: DISCIPLINA (FASE 3)
// ==========================================

router.get('/api/disciplina', authenticate, requireAnyModule('evaluacion_staff', 'asistencia_staff'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, j.nombres, j.apellido_paterno
       FROM disciplina d
       LEFT JOIN jugadores j ON d.rut_jugador = j.rut_jugador
       ORDER BY d.fecha_sancion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/disciplina]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/disciplina', authenticate, requireAnyModule('evaluacion_staff', 'asistencia_staff'), async (req, res) => {
  const { rut_jugador, tipo_sancion, razon_sancion, duracion_dias, multa_aplicada, aplicada_por } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO disciplina (rut_jugador, tipo_sancion, razon_sancion, fecha_sancion, duracion_dias, multa_aplicada, aplicada_por, estado)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, 'activa')
       RETURNING *`,
      [rut_jugador, tipo_sancion, razon_sancion, duracion_dias, multa_aplicada || 0, aplicada_por]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/disciplina]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
