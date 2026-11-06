// Rutas de tesorería: pagos, pagos de mensualidades, UTM, becas, revisiones de beca y migración de pagos.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const { authenticate, requireOwnerIdOrModule, requireModule, normalizarRutParaComparar, resolverPermisosDeActor, requireAnyModule } = require('../security/auth');
const { normalizarRol } = require('../security/accessControl');
const { pool, sheetsSyncManager } = require('../lib/db');
const { ROLES_JUGADORES_ACOTADOS, actorPuedeVerJugador, obtenerPupilosDeActor } = require('../lib/actores');
const { obtenerUTMParaMes, obtenerUTMVigente } = require('../lib/utm');
const { crearNotificacionApp } = require('../lib/notificaciones');

const router = express.Router();

const normalizarEstadoPagoMensualidad = (estado) => {
  const raw = String(estado || '').trim().toLowerCase();
  if (['aprobado', 'aprobada', 'pagado', 'pagada', 'ok', 'completado', 'completada'].includes(raw)) {
    return 'aprobado';
  }
  if (['rechazado', 'rechazada', 'fallido', 'fallida', 'anulado', 'anulada'].includes(raw)) {
    return 'rechazado';
  }
  return 'pendiente';
};

// ==========================================
// 3. ENDPOINTS: PAGOS & TESORERÍA
// ==========================================

// GET: Pagos por usuario
router.get('/api/pagos/usuario/:usuarioId', authenticate, requireOwnerIdOrModule('usuarioId', 'validacion_pagos'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pagos 
       WHERE usuario_id = $1 
       ORDER BY created_at DESC`,
      [req.params.usuarioId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/pagos/usuario/:usuarioId]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Todos los pagos (admin)
router.get('/api/pagos', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.nombre 
       FROM pagos p
       LEFT JOIN usuarios u ON p.usuario_id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/pagos]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pago
router.post('/api/pagos', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { usuario_id, monto, tipo, estado, comprobante } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO pagos 
       (usuario_id, monto, tipo, estado, comprobante)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [usuario_id, monto, tipo, estado || 'pendiente', comprobante]
    );

    const usuarioRes = await client.query(
      `SELECT email FROM usuarios WHERE id = $1 LIMIT 1`,
      [usuario_id]
    );

    const rutJugadorMirror = null;
    const correccionesPago = [];
    if (!rutJugadorMirror) {
      correccionesPago.push('rut_jugador pendiente de asignacion');
    }
    const estadoMensualidad = correccionesPago.length > 0
      ? 'pendiente'
      : normalizarEstadoPagoMensualidad(estado || 'pendiente');
    const fechaMesActual = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    await client.query(
      `INSERT INTO pagos_mensualidades (
         rut_jugador,
         correo_apoderado,
         concepto_pago,
         cantidad_meses_pagados,
         meses_correspondientes,
         monto_total_pagado,
         comprobante_url,
         estado_pago,
         fecha_aprobacion,
         notas_tesoreria,
         updated_at
       ) VALUES (
         $1,
         $2,
         $3,
         1,
         $4,
         $5,
         $6,
         $7,
         CASE WHEN $7 = 'aprobado' THEN NOW() ELSE NULL END,
         $8,
         NOW()
       )`,
      [
        rutJugadorMirror,
        usuarioRes.rows[0]?.email || null,
        tipo || 'Pago general',
        fechaMesActual,
        monto,
        comprobante || null,
        estadoMensualidad,
        correccionesPago.length > 0
          ? `Origen: /api/pagos (registro automático) | Correccion requerida: ${correccionesPago.join(', ')}`
          : 'Origen: /api/pagos (registro automático)',
      ]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/pagos]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT: Validar pago (admin)
router.put('/api/pagos/:pagoId/validar', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { estado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pagos 
       SET estado = $1, fecha_pago = NOW()
       WHERE id = $2
       RETURNING *`,
      [estado, req.params.pagoId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/pagos/:pagoId/validar]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. ENDPOINTS: PAGOS MENSUALIDADES (FASE 1)
// ==========================================

// Un pago "pertenece" al actor si él fue quien pagó (rut_pagos, o su correo
// si el rut no quedó registrado) o si es de uno de sus propios pupilos —
// mismo criterio de pertenencia que ya usa /api/jugadores.
const pagoEsDelActor = (pago, actor, rutsPupilos, correoActor) => {
  const rutActor = normalizarRutParaComparar(actor.rut);
  if (rutActor && normalizarRutParaComparar(pago.rut_pagos) === rutActor) return true;
  if (correoActor && String(pago.correo_apoderado || '').trim().toLowerCase() === correoActor) return true;
  if (pago.rut_jugador && rutsPupilos.has(normalizarRutParaComparar(pago.rut_jugador))) return true;
  // Pagos legacy sin rut_jugador poblado (solo rut_pagos, ej. de antes del
  // fix de FK vacía) -- mismo fallback que ya usa construirMorososDesdePagos
  // en el admin (App.jsx: "rutPagoJugador || rutPagoPagador"). Sin esto, un
  // pago real de un pupilo con rut_jugador vacío nunca le llegaba al
  // apoderado (aparecía "pagado" en el admin y "pendiente" en su propia
  // cuenta, mismo pago).
  if (!pago.rut_jugador && pago.rut_pagos && rutsPupilos.has(normalizarRutParaComparar(pago.rut_pagos))) return true;
  return false;
};

// GET: Todos los pagos de mensualidades — sin módulo de tesorería, un actor
// solo ve SUS PROPIOS pagos (los suyos como socio o los de sus pupilos), no
// los de otras familias. Antes cualquier sesión logueada recibía la tabla
// completa (monto, comprobante_url, notas de tesorería de todo el club).
router.get('/api/pagos-mensualidades', authenticate, async (req, res) => {
  try {
    const incluirLegacy = ['1', 'true', 'yes', 'si'].includes(String(req.query.includeLegacy || '').trim().toLowerCase());
    const whereLegacy = incluirLegacy
      ? ''
      : `WHERE NOT (
           COALESCE(pm.monto_total_pagado, 0) <= 0
           AND (
             COALESCE(pm.meses_correspondientes, '') ~* '^sinmes\\b'
             OR LOWER(COALESCE(pm.notas_tesoreria, '')) LIKE '%correccion requerida%'
           )
         )`;

    const result = await pool.query(
      `SELECT pm.*, j.nombres, j.apellido_paterno
       FROM pagos_mensualidades pm
       LEFT JOIN jugadores j ON pm.rut_jugador = j.rut_jugador
       ${whereLegacy}
       ORDER BY pm.fecha_registro DESC`
    );

    const permisos = await resolverPermisosDeActor(req.actor);
    if (permisos.validacion_pagos || permisos.admin_dashboard) {
      return res.json(result.rows);
    }
    const [pupilos, cuentaActor] = await Promise.all([
      obtenerPupilosDeActor(req.actor),
      pool.query('SELECT correo FROM cuentas WHERE rut = $1', [req.actor.rut]),
    ]);
    const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
    const correoActor = String(cuentaActor.rows[0]?.correo || '').trim().toLowerCase();
    res.json(result.rows.filter((pago) => pagoEsDelActor(pago, req.actor, rutsPupilos, correoActor)));
  } catch (err) {
    console.error('[GET /api/pagos-mensualidades]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: valor de UTM vigente para calcular la cuota socio (0.3 UTM). No
// requiere ningún módulo especial: es un dato de referencia, no algo que
// pueda modificarse desde acá.
router.get('/api/utm-vigente', authenticate, async (req, res) => {
  try {
    const info = await obtenerUTMVigente();
    res.json(info);
  } catch (err) {
    console.error('[GET /api/utm-vigente]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: valor de UTM de corte para CADA mes de un año — para que la deuda
// de un socio con varios meses impagos sume la cuota real de cada mes
// (0,3 UTM del corte de ese mes) en vez de multiplicar el mes actual por
// la cantidad de meses. Solo devuelve meses ya iniciados (no futuros: la
// UTM de un mes que aún no llega no existe todavía).
router.get('/api/utm-historico', authenticate, async (req, res) => {
  try {
    const anio = Number(req.query.anio) || new Date().getFullYear();
    const hoy = new Date();
    const mesTope = anio === hoy.getFullYear() ? (hoy.getMonth() + 1) : (anio < hoy.getFullYear() ? 12 : 0);

    const meses = Array.from({ length: mesTope }, (_, i) => i + 1);
    // Una sola consulta para los meses ya guardados; solo los que faltan
    // pasan por obtenerUTMParaMes (que consulta mindicador.cl y los guarda).
    // Antes eran hasta 12 consultas en paralelo por request, compitiendo por
    // el pool con el resto de las llamadas de arranque (~1 s en local).
    const guardados = await pool.query('SELECT mes, valor FROM utm_mensual WHERE anio = $1', [anio]);
    const porMes = {};
    guardados.rows.forEach((fila) => { porMes[Number(fila.mes)] = Number(fila.valor); });
    const faltantes = meses.filter((mes) => !Number.isFinite(porMes[mes]));
    const resultados = await Promise.all(faltantes.map((mes) => obtenerUTMParaMes(anio, mes)));
    resultados.forEach((r) => { porMes[r.mes] = r.valor; });
    Object.keys(porMes).forEach((mes) => { if (Number(mes) > mesTope) delete porMes[mes]; });
    res.json({ anio, porMes });
  } catch (err) {
    console.error('[GET /api/utm-historico]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: recalcula y pisa (UPDATE, no solo INSERT) el valor de UTM guardado
// para cada mes ya iniciado de un año. Uso puntual: corregir filas viejas
// (ej. sembradas con un valor placeholder antes de que existiera el fetch
// real a mindicador.cl) que de otro modo quedan congeladas para siempre,
// porque obtenerUTMParaMes normalmente nunca vuelve a tocar una fila que
// ya existe (ver comentario en ensureUtmMensualTable).
router.post('/api/admin/utm-historico/recalcular', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const anio = Number(req.body?.anio) || new Date().getFullYear();
    const hoy = new Date();
    const mesTope = anio === hoy.getFullYear() ? (hoy.getMonth() + 1) : (anio < hoy.getFullYear() ? 12 : 0);

    const meses = Array.from({ length: mesTope }, (_, i) => i + 1);
    const resultados = [];
    for (const mes of meses) {
      // Secuencial (no Promise.all) para no golpear mindicador.cl con 12
      // requests simultáneas de una vez.
      resultados.push(await obtenerUTMParaMes(anio, mes, { forzarRecalculo: true }));
    }

    sheetsSyncManager.enqueueTable('utm_mensual');
    res.json({ anio, resultados });
  } catch (err) {
    console.error('[POST /api/admin/utm-historico/recalcular]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pago de mensualidad
const ANIO_OBJETIVO_TESORERIA = 2026;
const MESES_ABREV_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const obtenerMesNumeroDesdeTexto = (texto = '') => {
  const normalizado = String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!normalizado) return null;
  const token = normalizado.slice(0, 3);
  const idx = MESES_ABREV_ES.findIndex((m) => m === token);
  return idx >= 0 ? idx + 1 : null;
};

// Primer mes/año de un pago, tolerante a los dos formatos vigentes:
// "mar-2026" (autoservicio de apoderado) y "Marzo 2026" / "Marzo-Abril 2026" (form admin).
const parsearPrimerMesDePago = (mesesCorrespondientes = '') => {
  const texto = String(mesesCorrespondientes || '').trim();
  if (!texto) return null;
  const anioMatch = texto.match(/(20\d{2})/);
  const anio = anioMatch ? Number(anioMatch[1]) : null;
  const sinAnio = texto.replace(/20\d{2}/g, '').trim();
  const primerToken = sinAnio.split(/[-\s]+/).filter(Boolean)[0] || '';
  const mes = obtenerMesNumeroDesdeTexto(primerToken);
  if (!mes || !anio) return null;
  return { mes, anio };
};

// Primer mes cobrable de un jugador. Si el admin fijó mes_inicio_cobro a mano,
// ese valor es su criterio final y se respeta tal cual (mismo criterio que ya
// usa el cálculo de morosos). Si no, se deriva de fecha_ingreso cobrando DESDE
// el mes de ingreso (regla confirmada por el club 2026-11-05; antes era el mes
// siguiente y no coincidía con el resumen de deuda del frontend). Debe
// coincidir con obtenerInicioCobro (PerfilTesoreriaPanel) y getMesIngreso (App).
const obtenerPrimerMesCobrableJugador = (jugador = {}) => {
  const anioCandidatos = [jugador?.anio_ingreso, jugador?.año_ingreso]
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v >= 2000 && v <= 2100);
  let anio = anioCandidatos[0] || null;

  const mesDesdeCampo = obtenerMesNumeroDesdeTexto(jugador?.mes_inicio_cobro || '');
  if (mesDesdeCampo) {
    if (!anio) {
      const matchFecha = String(jugador?.fecha_ingreso || '').match(/(20\d{2})/);
      anio = matchFecha ? Number(matchFecha[1]) : ANIO_OBJETIVO_TESORERIA;
    }
    return { anio, mes: mesDesdeCampo };
  }

  const fechaIngreso = String(jugador?.fecha_ingreso || '').trim();
  const fecha = fechaIngreso ? new Date(fechaIngreso) : null;
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    const anioFecha = anio || fecha.getFullYear();
    const mesFecha = fecha.getMonth() + 1;
    return { anio: anioFecha, mes: mesFecha };
  }

  return null;
};

router.post('/api/pagos-mensualidades', authenticate, requireAnyModule('perfil', 'validacion_pagos', 'admin_dashboard'), async (req, res) => {
  const {
    rut_jugador,
    rut_pagos,
    correo_apoderado,
    concepto_pago,
    cantidad_meses_pagados,
    meses_correspondientes,
    monto_total_pagado,
    comprobante_url,
  } = req.body;
  try {
    const rolNormalizadoPago = normalizarRol(req.actor.rol);
    const esStaffOAdminPago = !ROLES_JUGADORES_ACOTADOS.includes(rolNormalizadoPago);
    // Una familia solo puede informar pagos de sus propios pupilos (antes
    // podía crear pagos pendientes a nombre de cualquier deportista).
    // Tesorería/admin (por permiso, no solo por rol: ej. directiva con
    // override de validacion_pagos) sí registran pagos de cualquiera.
    const permisosPago = esStaffOAdminPago ? null : await resolverPermisosDeActor(req.actor);
    const puedeRegistrarPagosAjenos = esStaffOAdminPago || permisosPago.validacion_pagos || permisosPago.admin_dashboard;
    if (!puedeRegistrarPagosAjenos && String(rut_jugador || '').trim()
      && !(await actorPuedeVerJugador(req.actor, rut_jugador))) {
      return res.status(403).json({ error: 'Solo puedes informar pagos de tus propios deportistas.' });
    }
    if (!esStaffOAdminPago && String(rut_jugador || '').trim()) {
      const jugadorPago = (await pool.query(
        'SELECT fecha_ingreso, mes_inicio_cobro FROM jugadores WHERE rut_jugador = $1',
        [rut_jugador]
      )).rows[0];
      const primerMesCobrable = jugadorPago ? obtenerPrimerMesCobrableJugador(jugadorPago) : null;
      const primerMesDelPago = parsearPrimerMesDePago(meses_correspondientes);
      if (primerMesCobrable && primerMesDelPago) {
        const ordinalCobrable = primerMesCobrable.anio * 12 + primerMesCobrable.mes;
        const ordinalPago = primerMesDelPago.anio * 12 + primerMesDelPago.mes;
        if (ordinalPago < ordinalCobrable) {
          return res.status(400).json({
            error: `No se pueden pagar meses anteriores al inicio de cobro (${MESES_ABREV_ES[primerMesCobrable.mes - 1]}-${primerMesCobrable.anio}).`,
          });
        }
      }
    }

    let rutPagosFinal = String(rut_pagos || '').trim();

    if (!rutPagosFinal) {
      if (String(correo_apoderado || '').trim()) {
        const cuentaPorCorreo = await pool.query(
          `SELECT rut
           FROM cuentas
           WHERE LOWER(COALESCE(correo, '')) = LOWER($1)
           LIMIT 1`,
          [correo_apoderado]
        );
        rutPagosFinal = String(cuentaPorCorreo.rows[0]?.rut || '').trim();
      }

      if (!rutPagosFinal && String(rut_jugador || '').trim()) {
        const cuentaDesdeJugador = await pool.query(
          `SELECT c.rut
           FROM jugadores j
           LEFT JOIN cuentas c
             ON LOWER(COALESCE(c.correo, '')) = LOWER(COALESCE(j.correo_apoderado, ''))
           WHERE UPPER(REPLACE(REPLACE(COALESCE(j.rut_jugador, ''), '.', ''), '-', '')) = UPPER(REPLACE(REPLACE($1, '.', ''), '-', ''))
           LIMIT 1`,
          [rut_jugador]
        );
        rutPagosFinal = String(cuentaDesdeJugador.rows[0]?.rut || '').trim();
      }
    }

    const correccionesPago = [];
    if (!String(rut_jugador || '').trim() && !String(rutPagosFinal || '').trim()) {
      correccionesPago.push('rut_jugador/rut_pagos vacio');
    }
    if (!String(meses_correspondientes || '').trim()) correccionesPago.push('meses_correspondientes vacio');
    // $0 es válido a propósito (ej. un mes que el club decide dejar sin
    // cobro puntual) — antes esto también marcaba "corrección requerida" y
    // esPagoInvalidoLegacy (App.jsx) trataba ese pago como legacy inválido,
    // ignorándolo por completo pese a haberse guardado bien.
    if (monto_total_pagado === undefined || monto_total_pagado === null || monto_total_pagado === ''
      || !Number.isFinite(Number(monto_total_pagado)) || Number(monto_total_pagado) < 0) {
      correccionesPago.push('monto_total_pagado invalido');
    }

    const result = await pool.query(
      `INSERT INTO pagos_mensualidades 
       (rut_jugador, rut_pagos, correo_apoderado, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, comprobante_url, estado_pago, notas_tesoreria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', $9)
       RETURNING *`,
      [
        // rut_jugador tiene FK a jugadores — un pago "solo cuota de socio"
        // (sin deportista asociado) manda '' desde el frontend, que viola
        // la FK (a diferencia de NULL, que sí está permitido en la columna).
        String(rut_jugador || '').trim() || null,
        rutPagosFinal || null,
        correo_apoderado,
        concepto_pago,
        cantidad_meses_pagados,
        meses_correspondientes,
        monto_total_pagado,
        comprobante_url,
        correccionesPago.length > 0
          ? `Correccion requerida: ${correccionesPago.join(', ')}`
          : null,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/pagos-mensualidades]', err);
    res.status(500).json({ error: err.message });
  }
});

// Resuelve a quién avisar cuando se aprueba/rechaza un pago (manual o de la
// bandeja de validación): quien realmente pagó (rut_pagos), su cuenta por
// correo_apoderado como respaldo, y la cuenta propia del jugador si inició
// sesión alguna vez con su propio RUT — mismo criterio que
// resolverDestinatariosCitacion, para que un pago registrado sin pasar por
// la familia (ej. pago manual del admin) también le llegue.
const resolverDestinatariosPago = async (pago) => {
  const ruts = new Set();
  const rutPagos = String(pago.rut_pagos || '').trim();
  if (rutPagos) ruts.add(normalizarRutParaComparar(rutPagos));

  const correoApoderado = String(pago.correo_apoderado || '').trim();
  if (correoApoderado) {
    const cuentaPorCorreo = await pool.query('SELECT rut FROM cuentas WHERE LOWER(correo) = LOWER($1)', [correoApoderado]);
    if (cuentaPorCorreo.rows[0]?.rut) ruts.add(normalizarRutParaComparar(cuentaPorCorreo.rows[0].rut));
  }

  const rutJugador = String(pago.rut_jugador || '').trim();
  if (rutJugador) {
    const cuentaJugador = await pool.query(
      "SELECT rut FROM cuentas WHERE REPLACE(REPLACE(UPPER(rut), '.', ''), '-', '') = $1",
      [normalizarRutParaComparar(rutJugador)]
    );
    if (cuentaJugador.rows[0]?.rut) ruts.add(normalizarRutParaComparar(cuentaJugador.rows[0].rut));
  }

  return ruts;
};

// PUT: Validar pago de mensualidad (admin) — también es el paso final del
// pago manual (create + validar en el mismo flujo), así que notificar acá
// cubre ambos casos con un solo cambio.
router.put('/api/pagos-mensualidades/:id/validar', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { estado_pago } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pagos_mensualidades
       SET estado_pago = $1, fecha_aprobacion = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [estado_pago, req.params.id]
    );
    const pagoActualizado = result.rows[0];
    res.json(pagoActualizado);

    // No debe tumbar la validación si falla — mismo criterio que las
    // notificaciones de citaciones/asistencia.
    try {
      const estadoNormalizado = String(estado_pago || '').toLowerCase();
      if (pagoActualizado && (estadoNormalizado === 'aprobado' || estadoNormalizado === 'rechazado')) {
        const destinatarios = await resolverDestinatariosPago(pagoActualizado);
        const monto = Number(pagoActualizado.monto_total_pagado || 0);
        const detalle = `${pagoActualizado.concepto_pago || 'Pago'} · ${pagoActualizado.meses_correspondientes || ''} · $${monto.toLocaleString('es-CL')}`.trim();
        const titulo = estadoNormalizado === 'aprobado' ? 'Pago aprobado' : 'Pago rechazado';
        const cuerpo = estadoNormalizado === 'aprobado'
          ? `Se registró y aprobó tu pago: ${detalle}.`
          : `Tu pago fue rechazado: ${detalle}. Revisa el comprobante o contacta a tesorería.`;
        await Promise.all([...destinatarios].map((rut) => crearNotificacionApp({
          rut,
          tipo: 'pago',
          titulo,
          cuerpo,
          referenciaTipo: 'pago',
          referenciaId: pagoActualizado.id,
        })));
      }
    } catch (notifErr) {
      console.error('[PUT /api/pagos-mensualidades/:id/validar] error notificando:', notifErr.message);
    }
  } catch (err) {
    console.error('[PUT /api/pagos-mensualidades/:id/validar]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Obtener pago específico por ID — mismo criterio de pertenencia que la
// lista completa (antes cualquier sesión podía pedir por ID el pago de
// cualquier otra familia, sin comprobar dueño).
router.get('/api/pagos-mensualidades/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pm.*, j.nombres, j.apellido_paterno
       FROM pagos_mensualidades pm
       LEFT JOIN jugadores j ON pm.rut_jugador = j.rut_jugador
       WHERE pm.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    const pago = result.rows[0];

    const permisos = await resolverPermisosDeActor(req.actor);
    if (!permisos.validacion_pagos && !permisos.admin_dashboard) {
      const [pupilos, cuentaActor] = await Promise.all([
        obtenerPupilosDeActor(req.actor),
        pool.query('SELECT correo FROM cuentas WHERE rut = $1', [req.actor.rut]),
      ]);
      const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
      const correoActor = String(cuentaActor.rows[0]?.correo || '').trim().toLowerCase();
      if (!pagoEsDelActor(pago, req.actor, rutsPupilos, correoActor)) {
        return res.status(403).json({ error: 'No tienes acceso a este pago.' });
      }
    }
    res.json(pago);
  } catch (err) {
    console.error('[GET /api/pagos-mensualidades/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar pago de mensualidad (edición completa)
router.put('/api/pagos-mensualidades/:id', authenticate, requireAnyModule('validacion_pagos', 'admin_dashboard'), async (req, res) => {
  const {
    rut_jugador,
    rut_pagos,
    correo_apoderado,
    concepto_pago,
    cantidad_meses_pagados,
    meses_correspondientes,
    monto_total_pagado,
    comprobante_url,
    notas_tesoreria,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pagos_mensualidades 
       SET rut_jugador = $1, rut_pagos = $2, correo_apoderado = $3, concepto_pago = $4, cantidad_meses_pagados = $5,
           meses_correspondientes = $6, monto_total_pagado = $7, comprobante_url = $8, notas_tesoreria = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        // Mismo motivo que en POST /api/pagos-mensualidades: rut_jugador
        // tiene FK a jugadores, '' la viola (NULL sí está permitido).
        String(rut_jugador || '').trim() || null,
        rut_pagos,
        correo_apoderado,
        concepto_pago,
        cantidad_meses_pagados,
        meses_correspondientes,
        monto_total_pagado,
        comprobante_url,
        notas_tesoreria,
        req.params.id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/pagos-mensualidades/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: jugadores con beca activa (%>0) y si ya tienen revisión del mes
// pedido — el admin/superadmin designado confirma mes a mes que la beca
// sigue vigente (ver tabla beca_revisiones).
router.get('/api/beca-revisiones', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const mes = String(req.query.mes || '').trim();
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'Falta el parámetro mes en formato YYYY-MM.' });
  }
  try {
    const becados = await pool.query(
      `SELECT rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, beca
       FROM jugadores
       WHERE beca IS NOT NULL AND beca > 0 AND (estado IS NULL OR UPPER(estado) <> 'BAJA')
       ORDER BY nombres ASC`
    );
    const revisiones = await pool.query(
      `SELECT rut_jugador, porcentaje, revisado_por, revisado_en FROM beca_revisiones WHERE mes = $1`,
      [mes]
    );
    const revisionesPorRut = new Map(revisiones.rows.map((r) => [String(r.rut_jugador).trim(), r]));

    const resultado = becados.rows.map((j) => ({
      ...j,
      revision_mes_actual: revisionesPorRut.get(String(j.rut_jugador).trim()) || null,
    }));
    res.json(resultado);
  } catch (err) {
    console.error('[GET /api/beca-revisiones]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: confirma (o actualiza) la revisión mensual de una beca. Si el
// porcentaje cambió respecto al de jugadores.beca, también lo actualiza ahí
// (ej. se le bajó o retiró la beca al revisarla).
router.post('/api/beca-revisiones', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { rut_jugador, mes, porcentaje } = req.body;
  if (!String(rut_jugador || '').trim() || !/^\d{4}-\d{2}$/.test(String(mes || ''))) {
    return res.status(400).json({ error: 'Faltan rut_jugador o mes (formato YYYY-MM) válidos.' });
  }
  const porcentajeNum = Number(porcentaje);
  if (!Number.isFinite(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100) {
    return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const revision = await client.query(
      `INSERT INTO beca_revisiones (rut_jugador, mes, porcentaje, revisado_por, revisado_en)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (rut_jugador, mes) DO UPDATE
         SET porcentaje = EXCLUDED.porcentaje, revisado_por = EXCLUDED.revisado_por, revisado_en = NOW()
       RETURNING *`,
      [rut_jugador, mes, porcentajeNum, req.actor?.rut || null]
    );
    await client.query('UPDATE jugadores SET beca = $1 WHERE rut_jugador = $2', [porcentajeNum, rut_jugador]);
    await client.query('COMMIT');
    res.status(201).json(revision.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/beca-revisiones]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET: lista completa de becados (beca > 0 hoy), con vigencia y estado
// calculado — reemplaza tener que adivinar "¿esto sigue corriendo?" mirando
// solo el %. DIAS_ALERTA_VENCIMIENTO = ventana en la que una beca con fecha
// de fin ya pasa a marcarse "por_vencer" en vez de "vigente".
const DIAS_ALERTA_VENCIMIENTO_BECA = 15;
const calcularEstadoBeca = (fechaFin) => {
  if (!fechaFin) return 'vigente';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);
  const diasRestantes = Math.round((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diasRestantes < 0) return 'vencida';
  if (diasRestantes <= DIAS_ALERTA_VENCIMIENTO_BECA) return 'por_vencer';
  return 'vigente';
};

router.get('/api/becas', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  try {
    const becados = await pool.query(
      `SELECT rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria,
              beca, beca_fecha_inicio, beca_fecha_fin, beca_motivo, correo_apoderado
       FROM jugadores
       WHERE beca IS NOT NULL AND beca > 0 AND (estado IS NULL OR UPPER(estado) <> 'BAJA')
       ORDER BY nombres ASC`
    );
    const resultado = becados.rows.map((j) => ({
      ...j,
      estado_beca: calcularEstadoBeca(j.beca_fecha_fin),
    }));
    res.json(resultado);
  } catch (err) {
    console.error('[GET /api/becas]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: historial completo de ajustes de beca de UN jugador.
router.get('/api/becas/historial/:rut', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  try {
    const historial = await pool.query(
      `SELECT * FROM beca_historial WHERE rut_jugador = $1 ORDER BY creado_en DESC`,
      [req.params.rut]
    );
    res.json(historial.rows);
  } catch (err) {
    console.error('[GET /api/becas/historial/:rut]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: otorga o ajusta la beca de un jugador — deja una fila permanente en
// beca_historial (auditoría real, no se sobreescribe) Y actualiza el estado
// "actual" en jugadores para que el resto de la app (calcularCuotaFinal,
// morosos, etc.) siga leyendo un solo campo simple. fecha_fin es opcional
// (beca indefinida); fecha_inicio es obligatoria — el club pidió que TODO
// ajuste de beca quede con período explícito, no solo un % suelto.
router.post('/api/becas', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { rut_jugador, porcentaje, motivo, fecha_inicio, fecha_fin } = req.body;
  if (!String(rut_jugador || '').trim()) {
    return res.status(400).json({ error: 'Falta rut_jugador.' });
  }
  const porcentajeNum = Number(porcentaje);
  if (!Number.isFinite(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100) {
    return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100.' });
  }
  if (!fecha_inicio) {
    return res.status(400).json({ error: 'Falta la fecha de inicio de la beca.' });
  }
  if (fecha_fin && new Date(fecha_fin) < new Date(fecha_inicio)) {
    return res.status(400).json({ error: 'La fecha de término no puede ser anterior a la de inicio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const historial = await client.query(
      `INSERT INTO beca_historial (rut_jugador, porcentaje, motivo, fecha_inicio, fecha_fin, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [rut_jugador, porcentajeNum, motivo || null, fecha_inicio, fecha_fin || null, req.actor?.rut || null]
    );
    const jugadorActualizado = await client.query(
      `UPDATE jugadores
       SET beca = $1, beca_fecha_inicio = $2, beca_fecha_fin = $3, beca_motivo = $4, updated_at = NOW()
       WHERE rut_jugador = $5
       RETURNING rut_jugador, nombres, apellido_paterno, beca, beca_fecha_inicio, beca_fecha_fin, beca_motivo`,
      [porcentajeNum, fecha_inicio, fecha_fin || null, motivo || null, rut_jugador]
    );
    if (jugadorActualizado.rows.length === 0) {
      throw new Error(`No existe ningún jugador con rut ${rut_jugador}.`);
    }
    await client.query('COMMIT');
    // El middleware genérico de auto-export (ver getTableFromApiRequest) ya
    // encola 'jugadores' para este recurso — beca_historial se encola a mano
    // porque una sola fila de RESOURCE_TABLE_MAP no puede cubrir las dos
    // tablas que este endpoint toca en la misma transacción.
    sheetsSyncManager.enqueueTable('beca_historial');
    res.status(201).json({
      historial: historial.rows[0],
      jugador: { ...jugadorActualizado.rows[0], estado_beca: calcularEstadoBeca(jugadorActualizado.rows[0].beca_fecha_fin) },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /api/becas]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 22. ENDPOINTS: MIGRACIÓN PAGOS (FASE 2)
// ==========================================

// GET: Pagos migrados
router.get('/api/migracion-pagos', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM migracion_pagos ORDER BY fecha_migracion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/migracion-pagos]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear registro de migración
router.post('/api/migracion-pagos', authenticate, requireModule('validacion_pagos'), async (req, res) => {
  const { rut_jugador, nombre_jugador, mes_pago, año_pago, monto_pago, estado_pago, metodo_pago } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO migracion_pagos (rut_jugador, nombre_jugador, mes_pago, año_pago, monto_pago, estado_pago, metodo_pago)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [rut_jugador, nombre_jugador, mes_pago, año_pago, monto_pago, estado_pago, metodo_pago]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/migracion-pagos]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
