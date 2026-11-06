// Rutas de cuentas y usuarios: CRUD de cuentas, usuarios legacy, staff, contactos/envío WhatsApp y reconciliaciones de perfil/socio.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const { authenticate, requireModule, requireOwnerIdOrModule, hashPassword, stripFieldsUnlessModule, requireRole, requireAnyModule } = require('../security/auth');
const { normalizarRol, ROLES_BASE } = require('../security/accessControl');
const { pool, sheetsSyncManager } = require('../lib/db');
const { formatearRut, normalizarRut, validarRutChileno } = require('../lib/rut');
const { detectarCamposFaltantesCuenta, omitPassword } = require('../lib/cuentas');
const { normalizarRolSistema } = require('../lib/auditoria');

const router = express.Router();

// ==========================================
// 4. ENDPOINTS: USUARIOS
// ==========================================

// GET: Todos los usuarios
router.get('/api/usuarios', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, telefono, rol, activo, created_at 
       FROM usuarios 
       ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/usuarios]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Usuario por ID
router.get('/api/usuarios/:id', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, telefono, rol, activo FROM usuarios WHERE id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('[GET /api/usuarios/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear usuario
router.post('/api/usuarios', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { nombre, email, telefono, rol } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, telefono, rol, activo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [nombre, email, telefono, rol]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/usuarios]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4.1 ENDPOINTS: CUENTAS (APODERADOS/SOCIOS/STAFF)
// ==========================================

// GET: Todas las cuentas
router.get('/api/cuentas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cuentas ORDER BY apellido_paterno ASC, nombres ASC`
    );

    const cuentas = result.rows.map((cuenta) => ({
      ...omitPassword(cuenta),
      rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    }));

    res.json(cuentas);
  } catch (err) {
    console.error('[GET /api/cuentas]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Cuentas con información incompleta
router.get('/api/cuentas/incompletas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cuentas ORDER BY updated_at DESC');
    const incompletas = result.rows
      .map((cuenta) => ({
        ...omitPassword(cuenta),
        rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
        campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
      }))
      .filter((cuenta) => cuenta.campos_faltantes.length > 0);

    res.json(incompletas);
  } catch (err) {
    console.error('[GET /api/cuentas/incompletas]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Cuenta por ID
router.get('/api/cuentas/:id', authenticate, requireOwnerIdOrModule('id', 'admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cuentas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const cuenta = result.rows[0];
    res.json({
      ...omitPassword(cuenta),
      rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    console.error('[GET /api/cuentas/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear cuenta
router.post('/api/cuentas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const {
    correo,
    rut,
    password,
    nombres,
    apellido_paterno,
    apellido_materno,
    fecha_nacimiento,
    estado_civil,
    direccion,
    comuna,
    prefijo_tel,
    telefono,
    profesion_oficio,
    nombre_segundo_contacto,
    parentesco_segundo_contacto,
    num_segundo_contacto,
    es_socio,
    fecha_ingreso_socio,
    mes_inicio_cobro,
    rol,
    perfil_principal,
    cargo_directiva,
    socio_admin,
    aprobado_superadmin,
    acceso_nivel,
    utm_valor_referencia,
    monto_mensual_base,
    monto_mensual_override,
    condiciones_pago,
    fecha_corte_utm,
    permisos_override,
    forzar_clave,
    foto_perfil_url,
    requiere_foto_perfil,
    logo_url,
    estado,
    autorizacion_imagen,
    dia_pago_acordado,
  } = req.body;

  if (!correo || !rut) {
    return res.status(400).json({ error: 'correo y rut son obligatorios' });
  }

  if (!validarRutChileno(rut)) {
    return res.status(400).json({ error: 'RUT chileno inválido' });
  }

  try {
    const rutNormalizado = formatearRut(rut);
    const logoPerfilUrl = foto_perfil_url || logo_url || null;
    const passwordHash = password ? await hashPassword(password) : null;
    const result = await pool.query(
      `INSERT INTO cuentas (
        correo, rut, password, nombres, apellido_paterno, apellido_materno,
        fecha_nacimiento, estado_civil, direccion, comuna, prefijo_tel, telefono,
        profesion_oficio, nombre_segundo_contacto, parentesco_segundo_contacto,
        num_segundo_contacto, es_socio, fecha_ingreso_socio, mes_inicio_cobro, rol, perfil_principal,
        cargo_directiva, socio_admin, aprobado_superadmin, acceso_nivel,
        utm_valor_referencia, monto_mensual_base, monto_mensual_override,
        condiciones_pago, fecha_corte_utm, permisos_override, forzar_clave, foto_perfil_url,
        requiere_foto_perfil, estado, autorizacion_imagen, dia_pago_acordado
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37
      ) RETURNING *`,
      [
        correo,
        rutNormalizado,
        passwordHash,
        nombres || null,
        apellido_paterno || null,
        apellido_materno || null,
        fecha_nacimiento || null,
        estado_civil || null,
        direccion || null,
        comuna || null,
        prefijo_tel || null,
        telefono || null,
        profesion_oficio || null,
        nombre_segundo_contacto || null,
        parentesco_segundo_contacto || null,
        num_segundo_contacto || null,
        es_socio ?? false,
        fecha_ingreso_socio || null,
        mes_inicio_cobro || null,
        rol || 'apoderado',
        perfil_principal || rol || 'apoderado',
        cargo_directiva || null,
        socio_admin ?? false,
        aprobado_superadmin ?? false,
        acceso_nivel || 'estandar',
        utm_valor_referencia || null,
        monto_mensual_base || null,
        monto_mensual_override || null,
        condiciones_pago || null,
        fecha_corte_utm || null,
        permisos_override && typeof permisos_override === 'object' ? JSON.stringify(permisos_override) : JSON.stringify({}),
        forzar_clave ?? false,
        logoPerfilUrl,
        requiere_foto_perfil ?? false,
        estado || 'activo',
        autorizacion_imagen ?? false,
        dia_pago_acordado || null,
      ]
    );

    const cuenta = result.rows[0];
    res.json({
      ...omitPassword(cuenta),
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'correo o rut ya existe' });
    }
    console.error('[POST /api/cuentas]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar cuenta
const CAMPOS_CUENTA_SOLO_ADMIN = [
  'rol', 'perfil_principal', 'cargo_directiva', 'socio_admin', 'aprobado_superadmin',
  'acceso_nivel', 'utm_valor_referencia', 'monto_mensual_base', 'monto_mensual_override',
  'condiciones_pago', 'fecha_corte_utm', 'permisos_override', 'forzar_clave', 'estado',
  'autorizacion_imagen', 'dia_pago_acordado', 'es_socio', 'fecha_ingreso_socio', 'mes_inicio_cobro',
  // rut y correo son la identidad con la que obtenerPupilosDeActor vincula
  // a un apoderado con sus deportistas (rut_apoderado / correo_apoderado):
  // si el dueño pudiera cambiarlos, bastaba ponerse el correo o RUT de otro
  // apoderado para "adoptar" a sus hijos (ver pagos, ficha médica, citaciones).
  // Ningún flujo de autoservicio los edita (el onboarding solo manda nombre,
  // teléfono, dirección y foto). password tampoco: el dueño cambia su clave
  // por /api/auth/change-password, que exige la clave actual.
  'rut', 'correo', 'password',
];

router.put(
  '/api/cuentas/:id',
  authenticate,
  requireOwnerIdOrModule('id', 'admin_dashboard'),
  stripFieldsUnlessModule(CAMPOS_CUENTA_SOLO_ADMIN, 'admin_dashboard'),
  async (req, res) => {
  const {
    correo,
    rut,
    password,
    nombres,
    apellido_paterno,
    apellido_materno,
    fecha_nacimiento,
    estado_civil,
    direccion,
    comuna,
    prefijo_tel,
    telefono,
    profesion_oficio,
    nombre_segundo_contacto,
    parentesco_segundo_contacto,
    num_segundo_contacto,
    es_socio,
    fecha_ingreso_socio,
    mes_inicio_cobro,
    rol,
    perfil_principal,
    cargo_directiva,
    socio_admin,
    aprobado_superadmin,
    acceso_nivel,
    utm_valor_referencia,
    monto_mensual_base,
    monto_mensual_override,
    condiciones_pago,
    fecha_corte_utm,
    permisos_override,
    forzar_clave,
    foto_perfil_url,
    requiere_foto_perfil,
    estado,
    autorizacion_imagen,
    dia_pago_acordado,
    logo_url,
  } = req.body;

  if (rut && !validarRutChileno(rut)) {
    return res.status(400).json({ error: 'RUT chileno inválido' });
  }

  try {
    const rutNormalizado = rut ? formatearRut(rut) : null;
    const logoPerfilUrl = foto_perfil_url || logo_url || null;
    const passwordHash = password ? await hashPassword(password) : null;
    const result = await pool.query(
      `UPDATE cuentas SET
        correo = COALESCE($1, correo),
        rut = COALESCE($2, rut),
        password = COALESCE($3, password),
        nombres = COALESCE($4, nombres),
        apellido_paterno = COALESCE($5, apellido_paterno),
        apellido_materno = COALESCE($6, apellido_materno),
        fecha_nacimiento = COALESCE($7, fecha_nacimiento),
        estado_civil = COALESCE($8, estado_civil),
        direccion = COALESCE($9, direccion),
        comuna = COALESCE($10, comuna),
        prefijo_tel = COALESCE($11, prefijo_tel),
        telefono = COALESCE($12, telefono),
        profesion_oficio = COALESCE($13, profesion_oficio),
        nombre_segundo_contacto = COALESCE($14, nombre_segundo_contacto),
        parentesco_segundo_contacto = COALESCE($15, parentesco_segundo_contacto),
        num_segundo_contacto = COALESCE($16, num_segundo_contacto),
        es_socio = COALESCE($17, es_socio),
        fecha_ingreso_socio = COALESCE($18, fecha_ingreso_socio),
        mes_inicio_cobro = COALESCE($19, mes_inicio_cobro),
        rol = COALESCE($20, rol),
        perfil_principal = COALESCE($21, perfil_principal),
        cargo_directiva = COALESCE($22, cargo_directiva),
        socio_admin = COALESCE($23, socio_admin),
        aprobado_superadmin = COALESCE($24, aprobado_superadmin),
        acceso_nivel = COALESCE($25, acceso_nivel),
        utm_valor_referencia = COALESCE($26, utm_valor_referencia),
        monto_mensual_base = COALESCE($27, monto_mensual_base),
        monto_mensual_override = COALESCE($28, monto_mensual_override),
        condiciones_pago = COALESCE($29, condiciones_pago),
        fecha_corte_utm = COALESCE($30, fecha_corte_utm),
        permisos_override = COALESCE($31::jsonb, permisos_override),
        forzar_clave = COALESCE($32, forzar_clave),
        foto_perfil_url = COALESCE($33, foto_perfil_url),
        requiere_foto_perfil = COALESCE($34, requiere_foto_perfil),
        estado = COALESCE($35, estado),
        autorizacion_imagen = COALESCE($36, autorizacion_imagen),
        dia_pago_acordado = COALESCE($37, dia_pago_acordado),
        updated_at = NOW()
      WHERE id = $38
      RETURNING *`,
      [
        correo || null,
        rutNormalizado,
        passwordHash,
        nombres || null,
        apellido_paterno || null,
        apellido_materno || null,
        fecha_nacimiento || null,
        estado_civil || null,
        direccion || null,
        comuna || null,
        prefijo_tel || null,
        telefono || null,
        profesion_oficio || null,
        nombre_segundo_contacto || null,
        parentesco_segundo_contacto || null,
        num_segundo_contacto || null,
        es_socio,
        fecha_ingreso_socio || null,
        mes_inicio_cobro || null,
        rol || null,
        perfil_principal || null,
        cargo_directiva || null,
        socio_admin,
        aprobado_superadmin,
        acceso_nivel || null,
        utm_valor_referencia || null,
        monto_mensual_base || null,
        monto_mensual_override || null,
        condiciones_pago || null,
        fecha_corte_utm || null,
        permisos_override && typeof permisos_override === 'object' ? JSON.stringify(permisos_override) : null,
        forzar_clave,
        logoPerfilUrl,
        requiere_foto_perfil,
        estado || null,
        autorizacion_imagen,
        dia_pago_acordado || null,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const cuenta = result.rows[0];
    res.json({
      ...omitPassword(cuenta),
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'correo o rut ya existe' });
    }
    console.error('[POST /api/cuentas]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Borrar cuenta definitivamente (solo super admin)
router.delete('/api/cuentas/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  const actor = req.actor;

  const idCuenta = Number.parseInt(String(req.params.id || ''), 10);
  if (!Number.isFinite(idCuenta) || idCuenta <= 0) {
    return res.status(400).json({ error: 'ID de cuenta inválido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cuentaRes = await client.query(
      `SELECT id, correo, rut, rol, perfil_principal
       FROM cuentas
       WHERE id = $1
       LIMIT 1`,
      [idCuenta]
    );

    if (cuentaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta no encontrada.' });
    }

    const cuenta = cuentaRes.rows[0];
    const rolCuenta = normalizarRolSistema(cuenta.rol || cuenta.perfil_principal || '');
    if (rolCuenta === 'super_admin') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se puede borrar una cuenta super admin.' });
    }

    const rutCuentaNormalizado = normalizarRut(cuenta.rut || '');
    if ((actor.id && String(actor.id) === String(cuenta.id)) || (actor.rut && normalizarRut(actor.rut) === rutCuentaNormalizado)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No puedes borrar tu propia cuenta.' });
    }

    let jugadoresDesvinculados = 0;
    const correoCuenta = String(cuenta.correo || '').trim().toLowerCase();
    if (correoCuenta) {
      const desvincular = await client.query(
        `UPDATE jugadores
         SET correo_apoderado = ''
         WHERE LOWER(COALESCE(correo_apoderado, '')) = $1`,
        [correoCuenta]
      );
      jugadoresDesvinculados = desvincular.rowCount || 0;
    }

    await client.query('DELETE FROM cuentas WHERE id = $1', [idCuenta]);

    await client.query('COMMIT');
    return res.json({
      ok: true,
      message: 'Cuenta eliminada definitivamente.',
      deleted: { id: idCuenta },
      jugadores_desvinculados: jugadoresDesvinculados,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignorar errores secundarios de rollback.
    }
    console.error('[DELETE /api/cuentas/:id]', err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. ENDPOINTS: CONTACTOS WHATSAPP
// ==========================================

// GET: Contactos WhatsApp
router.get('/api/whatsapp/contactos', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contactos_whatsapp WHERE activo = true ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/whatsapp/contactos]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Agregar contacto WhatsApp
router.post('/api/whatsapp/contactos', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { nombre, numero } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO contactos_whatsapp (nombre, numero, activo)
       VALUES ($1, $2, true)
       RETURNING *`,
      [nombre, numero]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Número ya existe' });
    } else {
      console.error('[POST /api/whatsapp/contactos]', err);
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE: Eliminar contacto WhatsApp
router.delete('/api/whatsapp/contactos/:id', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE contactos_whatsapp SET activo = false WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Contacto eliminado' });
  } catch (err) {
    console.error('[DELETE /api/whatsapp/contactos/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Enviar mensaje WhatsApp (simulado)
router.post('/api/whatsapp/enviar', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { numero, mensaje, tipo } = req.body;
  try {
    // Guardar en historial
    const result = await pool.query(
      `INSERT INTO historial_whatsapp (numero, mensaje, tipo, estado)
       VALUES ($1, $2, $3, 'enviado')
       RETURNING *`,
      [numero, mensaje, tipo]
    );
    
    // Simular webhook después de 2s
    setTimeout(() => {
      pool.query(
        `UPDATE historial_whatsapp SET estado = 'entregado' WHERE id = $1`,
        [result.rows[0].id]
      );
    }, 2000);
    
    res.json({ success: true, mensaje_id: result.rows[0].id });
  } catch (err) {
    console.error('[POST /api/whatsapp/enviar]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: cuentas de socio con un monto de cuota "pisado a mano"
// (monto_mensual_base o utm_valor_referencia), que por diseño gana por
// sobre el cálculo real de 0,3 UTM del mes — ver obtenerCuotaSocioDelMes
// en App.jsx. Sirve para auditar antes de limpiar un valor viejo (ver
// /api/admin/cuentas-socio-override/limpiar).
router.get('/api/admin/cuentas-socio-override', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT id, rut, nombres, apellido_paterno, monto_mensual_base, utm_valor_referencia
      FROM cuentas
      WHERE (es_socio = true OR perfil_principal IN ('socio', 'socio_apoderado', 'directiva') OR rol IN ('socio', 'socio_apoderado', 'directiva'))
        AND (COALESCE(monto_mensual_base, 0) > 0 OR COALESCE(utm_valor_referencia, 0) > 0)
      ORDER BY nombres
    `);
    res.json({ total: resultado.rows.length, cuentas: resultado.rows });
  } catch (err) {
    console.error('[GET /api/admin/cuentas-socio-override]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: limpia (deja en NULL) el override de cuota de socio SOLO en las
// cuentas donde vale exactamente 68000 — el placeholder que quedaba
// guardado por el formulario de cuenta antes de existir el cálculo real
// (ver comentario de aplicarReglaMensualidad en SuperAdminPanel.jsx). No
// toca cuentas con un valor distinto: ese sí podría ser un acuerdo real
// escrito a mano por un admin y no se borra sin revisión.
router.post('/api/admin/cuentas-socio-override/limpiar', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const resultado = await pool.query(`
      UPDATE cuentas
      SET monto_mensual_base = NULL, utm_valor_referencia = NULL
      WHERE (monto_mensual_base = 68000 OR utm_valor_referencia = 68000)
      RETURNING id, rut, nombres, apellido_paterno
    `);
    if (resultado.rows.length > 0) {
      sheetsSyncManager.enqueueTable('cuentas');
    }
    res.json({ total: resultado.rows.length, cuentas: resultado.rows });
  } catch (err) {
    console.error('[POST /api/admin/cuentas-socio-override/limpiar]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: cuentas donde `rol` y `perfil_principal` no coinciden. Solo `rol`
// determina permisos reales (ver signToken en security/auth.js) --
// `perfil_principal` históricamente era solo decorativo, así que ambos
// podían desincronizarse (ej. rol=admin + perfil_principal=apoderado deja
// a la cuenta sin el módulo de Pupilos aunque la etiqueta diga
// "apoderado"). El frontend ya escribe ambos campos juntos desde un único
// selector de ahora en adelante; esto es para reconciliar cuentas viejas.
router.get('/api/admin/cuentas-perfil-mismatch', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT id, rut, correo, nombres, apellido_paterno, rol, perfil_principal, es_socio
      FROM cuentas
      WHERE UPPER(COALESCE(rol, '')) <> UPPER(COALESCE(perfil_principal, ''))
      ORDER BY nombres
    `);
    const cuentas = resultado.rows.map((c) => {
      const rolNormalizado = normalizarRol(c.rol);
      if (!c.rol) {
        return { ...c, accion: 'usar_perfil_principal', automatica: true };
      }
      if (Object.prototype.hasOwnProperty.call(ROLES_BASE, rolNormalizado)) {
        return { ...c, accion: 'sincronizar_a_rol', automatica: true };
      }
      return { ...c, accion: 'revisar_a_mano', automatica: false };
    });
    res.json({ total: cuentas.length, cuentas });
  } catch (err) {
    console.error('[GET /api/admin/cuentas-perfil-mismatch]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: aplica la reconciliación automática (ver GET de arriba) -- deja
// intactas las que necesitan revisión manual (accion: 'revisar_a_mano').
router.post('/api/admin/cuentas-perfil-mismatch/reconciliar', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const pendientes = await pool.query(`
      SELECT id, rol, perfil_principal
      FROM cuentas
      WHERE UPPER(COALESCE(rol, '')) <> UPPER(COALESCE(perfil_principal, ''))
    `);

    const corregidas = [];
    const saltadas = [];
    for (const c of pendientes.rows) {
      let valorFinal = null;
      if (!c.rol) {
        valorFinal = c.perfil_principal;
      } else if (Object.prototype.hasOwnProperty.call(ROLES_BASE, normalizarRol(c.rol))) {
        valorFinal = normalizarRol(c.rol);
      }
      if (!valorFinal) {
        saltadas.push(c.id);
        continue;
      }
      const actualizada = await pool.query(
        `UPDATE cuentas SET rol = $1, perfil_principal = $1, updated_at = NOW() WHERE id = $2 RETURNING id, rut, nombres, apellido_paterno, rol, perfil_principal`,
        [valorFinal, c.id]
      );
      corregidas.push(actualizada.rows[0]);
    }

    if (corregidas.length > 0) {
      sheetsSyncManager.enqueueTable('cuentas');
    }
    res.json({ corregidas: corregidas.length, cuentas: corregidas, saltadasPorRevisar: saltadas.length });
  } catch (err) {
    console.error('[POST /api/admin/cuentas-perfil-mismatch/reconciliar]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 25. ENDPOINTS: STAFF (FASE 3)
// ==========================================

router.get('/api/staff', authenticate, requireAnyModule('admin_dashboard', 'asistencia_staff', 'horarios_entrenamiento'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM staff WHERE activo = true ORDER BY apellido_paterno ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/staff]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/staff', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { rut_staff, nombres, apellido_paterno, apellido_materno, cargo, rama, email, telefono } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO staff (rut_staff, nombres, apellido_paterno, apellido_materno, cargo, rama, email, telefono, fecha_ingreso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
       RETURNING *`,
      [rut_staff, nombres, apellido_paterno, apellido_materno, cargo, rama, email, telefono]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/staff]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
