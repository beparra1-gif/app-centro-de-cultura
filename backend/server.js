const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();
const cron = require('node-cron');

const app = express();

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: '*', // Permitir todos en desarrollo
  credentials: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ========== DATABASE POOL ==========
const rawDatabaseUrl = String(process.env.DATABASE_URL || '');
const safeDatabaseUrl = rawDatabaseUrl.includes('sslmode=require')
  ? rawDatabaseUrl.replace('sslmode=require', 'sslmode=no-verify')
  : rawDatabaseUrl;

const shouldUseSsl =
  String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
  rawDatabaseUrl.includes('ondigitalocean.com') ||
  rawDatabaseUrl.includes('sslmode=require') ||
  rawDatabaseUrl.includes('sslmode=no-verify');

const pool = new Pool({
  connectionString: safeDatabaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Error en pool:', err);
});

const normalizarRut = (rut = '') => {
  return String(rut).replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
};

const validarRutChileno = (rut = '') => {
  const limpio = normalizarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  let dvEsperado = '';
  if (resto === 11) dvEsperado = '0';
  else if (resto === 10) dvEsperado = 'K';
  else dvEsperado = String(resto);

  return dv === dvEsperado;
};

const formatearRut = (rut = '') => {
  const limpio = normalizarRut(rut);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo}-${dv}`;
};

const camposObligatoriosCuenta = [
  'correo',
  'rut',
  'nombres',
  'apellido_paterno',
  'telefono',
  'direccion',
  'comuna',
  'rol'
];

const detectarCamposFaltantesCuenta = (cuenta) => {
  const faltantes = [];
  for (const campo of camposObligatoriosCuenta) {
    const valor = cuenta[campo];
    if (valor == null || String(valor).trim() === '') {
      faltantes.push(campo);
    }
  }

  const correo = String(cuenta.correo || '').toLowerCase();
  if (correo.endsWith('@actualizar.local')) {
    faltantes.push('correo');
  }

  const rut = String(cuenta.rut || '').toUpperCase();
  if (rut.startsWith('PENDIENTE-RUT-')) {
    faltantes.push('rut');
  }

  if (cuenta.rut && !validarRutChileno(cuenta.rut)) {
    faltantes.push('rut_valido');
  }

  return faltantes;
};

const ensureSuperAdminAccount = async () => {
  const enabled = String(process.env.AUTO_BOOTSTRAP_SUPER_ADMIN || '').toLowerCase() === 'true';
  if (!enabled) return;

  const email = process.env.SUPER_ADMIN_EMAIL;
  const rut = process.env.SUPER_ADMIN_RUT;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const nombres = process.env.SUPER_ADMIN_NOMBRES || 'Super';
  const apellido = process.env.SUPER_ADMIN_APELLIDO || 'Admin';

  if (!email || !rut || !password) {
    console.warn('⚠️ AUTO_BOOTSTRAP_SUPER_ADMIN activo pero faltan variables SUPER_ADMIN_EMAIL/RUT/PASSWORD');
    return;
  }

  if (!validarRutChileno(rut)) {
    console.warn('⚠️ SUPER_ADMIN_RUT inválido, no se creó cuenta super admin');
    return;
  }

  const rutFmt = formatearRut(rut);

  await pool.query(
    `INSERT INTO cuentas (
      correo, rut, password, nombres, apellido_paterno, rol, estado,
      es_socio, forzar_clave, autorizacion_imagen
    ) VALUES ($1,$2,$3,$4,$5,'super_admin','activo',false,false,true)
    ON CONFLICT (correo)
    DO UPDATE SET
      rut = EXCLUDED.rut,
      password = EXCLUDED.password,
      nombres = EXCLUDED.nombres,
      apellido_paterno = EXCLUDED.apellido_paterno,
      rol = 'super_admin',
      estado = 'activo',
      updated_at = NOW()`,
    [email, rutFmt, password, nombres, apellido]
  );

  console.log(`🔐 Super admin asegurado: ${email} (${rutFmt})`);
};

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ==========================================
// AUTH: LOGIN BÁSICO POR RUT/PASSWORD
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { rut, password } = req.body;

  if (!rut || !password) {
    return res.status(400).json({ error: 'rut y password son obligatorios' });
  }

  try {
    const rutNormalizado = normalizarRut(rut);
    const result = await pool.query(
      `SELECT id, correo, rut, password, nombres, apellido_paterno, rol, estado
       FROM cuentas
       WHERE UPPER(REPLACE(REPLACE(rut, '.', ''), '-', '')) = $1
       LIMIT 1`,
      [rutNormalizado]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const cuenta = result.rows[0];
    if (cuenta.estado && String(cuenta.estado).toLowerCase() !== 'activo') {
      return res.status(403).json({ error: 'Cuenta inactiva' });
    }

    if (!cuenta.password || String(cuenta.password) !== String(password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const rolDb = String(cuenta.rol || '').toLowerCase();
    const rolSistema = rolDb === 'super_admin' || rolDb === 'superadmin' ? 'super_admin' : rolDb || 'jugador';

    res.json({
      ok: true,
      user: {
        id: cuenta.id,
        nombre: `${cuenta.nombres || ''} ${cuenta.apellido_paterno || ''}`.trim() || cuenta.correo,
        correo: cuenta.correo,
        rut: formatearRut(cuenta.rut),
        rol: rolSistema,
        access_profiles: rolSistema === 'super_admin'
          ? ['super_admin', 'admin', 'staff', 'mesa', 'jugador', 'visita']
          : [rolSistema]
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 1. ENDPOINTS: COMUNICACIONES
// ==========================================

// GET: Todas las comunicaciones
app.get('/api/comunicaciones', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, titulo, cuerpo_texto, tipo, rama, categoria, urgencia, 
        solicita_asistencia, reacciones, asistencias,
        created_at as fecha
      FROM comunicaciones 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Comunicación por ID
app.get('/api/comunicaciones/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicaciones WHERE id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear comunicación
app.post('/api/comunicaciones', async (req, res) => {
  const { titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO comunicaciones 
       (titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia, reacciones, asistencias)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia || false, '{}', '[]']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar comunicación
app.put('/api/comunicaciones/:id', async (req, res) => {
  const { titulo, cuerpo_texto, urgencia } = req.body;
  try {
    const result = await pool.query(
      `UPDATE comunicaciones 
       SET titulo = $1, cuerpo_texto = $2, urgencia = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [titulo, cuerpo_texto, urgencia, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Eliminar comunicación
app.delete('/api/comunicaciones/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM comunicaciones WHERE id = $1', [req.params.id]);
    res.json({ message: 'Comunicación eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. ENDPOINTS: COMENTARIOS
// ==========================================

// GET: Comentarios de una comunicación
app.get('/api/comunicaciones/:comId/comentarios', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM comentarios 
       WHERE comunicacion_id = $1 
       ORDER BY created_at ASC`,
      [req.params.comId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear comentario
app.post('/api/comunicaciones/:comId/comentarios', async (req, res) => {
  const { usuario_id, texto, parent_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO comentarios 
       (comunicacion_id, usuario_id, texto, parent_id, likes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.comId, usuario_id, texto, parent_id || null, 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Like comentario
app.put('/api/comentarios/:comentId/like', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE comentarios 
       SET likes = likes + 1
       WHERE id = $1
       RETURNING *`,
      [req.params.comentId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. ENDPOINTS: PAGOS & TESORERÍA
// ==========================================

// GET: Pagos por usuario
app.get('/api/pagos/usuario/:usuarioId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pagos 
       WHERE usuario_id = $1 
       ORDER BY created_at DESC`,
      [req.params.usuarioId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Todos los pagos (admin)
app.get('/api/pagos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.nombre 
       FROM pagos p
       LEFT JOIN usuarios u ON p.usuario_id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pago
app.post('/api/pagos', async (req, res) => {
  const { usuario_id, monto, tipo, estado, comprobante } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO pagos 
       (usuario_id, monto, tipo, estado, comprobante)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [usuario_id, monto, tipo, estado || 'pendiente', comprobante]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Validar pago (admin)
app.put('/api/pagos/:pagoId/validar', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ENDPOINTS: USUARIOS
// ==========================================

// GET: Todos los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, telefono, rol, activo, created_at 
       FROM usuarios 
       ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Usuario por ID
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, telefono, rol, activo FROM usuarios WHERE id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear usuario
app.post('/api/usuarios', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4.1 ENDPOINTS: CUENTAS (APODERADOS/SOCIOS/STAFF)
// ==========================================

// GET: Todas las cuentas
app.get('/api/cuentas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cuentas ORDER BY apellido_paterno ASC, nombres ASC`
    );

    const cuentas = result.rows.map((cuenta) => ({
      ...cuenta,
      rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    }));

    res.json(cuentas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Cuentas con información incompleta
app.get('/api/cuentas/incompletas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cuentas ORDER BY updated_at DESC');
    const incompletas = result.rows
      .map((cuenta) => ({
        ...cuenta,
        rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
        campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
      }))
      .filter((cuenta) => cuenta.campos_faltantes.length > 0);

    res.json(incompletas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Cuenta por ID
app.get('/api/cuentas/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cuentas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const cuenta = result.rows[0];
    res.json({
      ...cuenta,
      rut: cuenta.rut ? formatearRut(cuenta.rut) : cuenta.rut,
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear cuenta
app.post('/api/cuentas', async (req, res) => {
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
    rol,
    forzar_clave,
    foto_perfil_url,
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
    const result = await pool.query(
      `INSERT INTO cuentas (
        correo, rut, password, nombres, apellido_paterno, apellido_materno,
        fecha_nacimiento, estado_civil, direccion, comuna, prefijo_tel, telefono,
        profesion_oficio, nombre_segundo_contacto, parentesco_segundo_contacto,
        num_segundo_contacto, es_socio, fecha_ingreso_socio, rol, forzar_clave,
        foto_perfil_url, estado, autorizacion_imagen, dia_pago_acordado
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      ) RETURNING *`,
      [
        correo,
        rutNormalizado,
        password || null,
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
        rol || 'apoderado',
        forzar_clave ?? false,
        foto_perfil_url || null,
        estado || 'activo',
        autorizacion_imagen ?? false,
        dia_pago_acordado || null,
      ]
    );

    const cuenta = result.rows[0];
    res.json({
      ...cuenta,
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'correo o rut ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar cuenta
app.put('/api/cuentas/:id', async (req, res) => {
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
    rol,
    forzar_clave,
    foto_perfil_url,
    estado,
    autorizacion_imagen,
    dia_pago_acordado,
  } = req.body;

  if (rut && !validarRutChileno(rut)) {
    return res.status(400).json({ error: 'RUT chileno inválido' });
  }

  try {
    const rutNormalizado = rut ? formatearRut(rut) : null;
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
        rol = COALESCE($19, rol),
        forzar_clave = COALESCE($20, forzar_clave),
        foto_perfil_url = COALESCE($21, foto_perfil_url),
        estado = COALESCE($22, estado),
        autorizacion_imagen = COALESCE($23, autorizacion_imagen),
        dia_pago_acordado = COALESCE($24, dia_pago_acordado),
        updated_at = NOW()
      WHERE id = $25
      RETURNING *`,
      [
        correo || null,
        rutNormalizado,
        password || null,
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
        rol || null,
        forzar_clave,
        foto_perfil_url || null,
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
      ...cuenta,
      campos_faltantes: detectarCamposFaltantesCuenta(cuenta),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'correo o rut ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. ENDPOINTS: CONTACTOS WHATSAPP
// ==========================================

// GET: Contactos WhatsApp
app.get('/api/whatsapp/contactos', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contactos_whatsapp WHERE activo = true ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Agregar contacto WhatsApp
app.post('/api/whatsapp/contactos', async (req, res) => {
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
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE: Eliminar contacto WhatsApp
app.delete('/api/whatsapp/contactos/:id', async (req, res) => {
  try {
    await pool.query(
      'UPDATE contactos_whatsapp SET activo = false WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Contacto eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Enviar mensaje WhatsApp (simulado)
app.post('/api/whatsapp/enviar', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ENDPOINTS: REPORTES & ANALYTICS
// ==========================================

// GET: Reportes de engagement
app.get('/api/reportes/engagement', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM comunicaciones) as total_comunicaciones,
        (SELECT SUM(CAST(reacciones->>key AS INTEGER)) FROM comunicaciones, jsonb_object_keys(reacciones) key) as total_reacciones,
        (SELECT COUNT(*) FROM comentarios) as total_comentarios,
        (SELECT COUNT(DISTINCT usuario_id) FROM comentarios) as usuarios_activos
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Top comunicaciones
app.get('/api/reportes/top-comunicaciones', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.titulo,
        COUNT(com.id) as comentarios,
        (SELECT SUM(CAST(value AS INTEGER)) FROM jsonb_each_text(c.reacciones)) as reacciones
      FROM comunicaciones c
      LEFT JOIN comentarios com ON c.id = com.comunicacion_id
      GROUP BY c.id, c.titulo
      ORDER BY comentarios DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. ENCUESTAS
// ==========================================

// GET: Encuestas
app.get('/api/encuestas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM encuestas ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear encuesta
app.post('/api/encuestas', async (req, res) => {
  const { pregunta, opciones } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO encuestas (pregunta, opciones, votos)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [pregunta, JSON.stringify(opciones), JSON.stringify({})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Votar en encuesta
app.put('/api/encuestas/:encuestaId/votar', async (req, res) => {
  const { opcion } = req.body;
  try {
    const encuesta = await pool.query('SELECT votos FROM encuestas WHERE id = $1', [req.params.encuestaId]);
    const votos = encuesta.rows[0]?.votos || {};
    votos[opcion] = (votos[opcion] || 0) + 1;
    
    const result = await pool.query(
      'UPDATE encuestas SET votos = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(votos), req.params.encuestaId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. TASKS AUTOMÁTICAS (Cron)
// ==========================================

// Sincronizar con Google Sheets cada 24h (configurable después)
cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] Sincronizando con Google Sheets...');
  // TODO: Implementar sincronización con Google Sheets API
});

// Limpiar notificaciones antiguas cada 7 días
cron.schedule('0 3 * * 0', async () => {
  console.log('[CRON] Limpiando notificaciones antiguas...');
  await pool.query(`
    DELETE FROM notificaciones 
    WHERE created_at < NOW() - INTERVAL '30 days'
  `);
});

// ==========================================
// 9. ENDPOINTS: JUGADORES (FASE 1)
// ==========================================

// GET: Todos los jugadores
app.get('/api/jugadores', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jugadores ORDER BY apellido_paterno ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Jugador por RUT
app.get('/api/jugadores/:rut', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM jugadores WHERE rut_jugador = $1',
      [req.params.rut]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear jugador
app.post('/api/jugadores', async (req, res) => {
  const { rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, correo_apoderado } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO jugadores 
       (rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, correo_apoderado, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
       RETURNING *`,
      [rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, correo_apoderado]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. ENDPOINTS: PAGOS MENSUALIDADES (FASE 1)
// ==========================================

// GET: Todos los pagos de mensualidades
app.get('/api/pagos-mensualidades', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pm.*, j.nombres, j.apellido_paterno
       FROM pagos_mensualidades pm
       LEFT JOIN jugadores j ON pm.rut_jugador = j.rut_jugador
       ORDER BY pm.fecha_registro DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pago de mensualidad
app.post('/api/pagos-mensualidades', async (req, res) => {
  const { rut_jugador, correo_apoderado, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, comprobante_url } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO pagos_mensualidades 
       (rut_jugador, correo_apoderado, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, comprobante_url, estado_pago)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
       RETURNING *`,
      [rut_jugador, correo_apoderado, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, comprobante_url]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Validar pago de mensualidad (admin)
app.put('/api/pagos-mensualidades/:id/validar', async (req, res) => {
  const { estado_pago } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pagos_mensualidades 
       SET estado_pago = $1, fecha_aprobacion = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [estado_pago, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. ENDPOINTS: CONVOCATORIAS/CITACIONES (FASE 1)
// ==========================================

// GET: Todas las convocatorias
app.get('/api/convocatorias', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM convocatorias ORDER BY dia_partido DESC, hora_citacion ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear convocatoria
app.post('/api/convocatorias', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 12. ENDPOINTS: EVENTOS (FASE 1)
// ==========================================

// GET: Todos los eventos
app.get('/api/eventos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM eventos ORDER BY fecha DESC, hora ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear evento
app.post('/api/eventos', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. ENDPOINTS: ASISTENCIA (FASE 1)
// ==========================================

// GET: Asistencia
app.get('/api/asistencia', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, j.nombres, j.apellido_paterno
       FROM asistencia a
       LEFT JOIN jugadores j ON a.rut_jugador = j.rut_jugador
       ORDER BY a.fecha DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Registrar asistencia
app.post('/api/asistencia', async (req, res) => {
  const { fecha, rama, categoria, rut_jugador, estado_asistencia, observacion, entrenador_cargo } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO asistencia 
       (fecha, rama, categoria, rut_jugador, estado_asistencia, observacion, entrenador_cargo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [fecha, rama, categoria, rut_jugador, estado_asistencia, observacion, entrenador_cargo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 14. ENDPOINTS: PARTIDOS EN VIVO (FASE 1)
// ==========================================

// GET: Partidos en vivo
app.get('/api/partidos-live', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM partidos_live ORDER BY fecha_hora DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear partido
app.post('/api/partidos-live', async (req, res) => {
  const { fecha_hora, cancha_sede, categoria_rama, equipo_local, equipo_visitante, rut_planillero } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO partidos_live 
       (fecha_hora, cancha_sede, categoria_rama, equipo_local, equipo_visitante, rut_planillero, estado_juego)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
       RETURNING *`,
      [fecha_hora, cancha_sede, categoria_rama, equipo_local, equipo_visitante, rut_planillero]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar marcador
app.put('/api/partidos-live/:id', async (req, res) => {
  const { pts_local, pts_visitante, estado_juego, periodo_actual } = req.body;
  try {
    const result = await pool.query(
      `UPDATE partidos_live 
       SET pts_local = $1, pts_visitante = $2, estado_juego = $3, periodo_actual = $4, updated_at = NOW()
       WHERE id_partido = $5
       RETURNING *`,
      [pts_local, pts_visitante, estado_juego, periodo_actual, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 15. ENDPOINTS: ESTADÍSTICAS (FASE 2)
// ==========================================

// GET: Estadísticas de un partido
app.get('/api/estadisticas/partido/:partidoId', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear estadística
app.post('/api/estadisticas', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 16. ENDPOINTS: EVALUACIONES (FASE 2)
// ==========================================

// GET: Evaluaciones de un jugador
app.get('/api/evaluaciones/jugador/:rut', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM evaluaciones WHERE rut_jugador = $1 ORDER BY fecha_evaluacion DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear evaluación
app.post('/api/evaluaciones', async (req, res) => {
  const { rut_jugador, evaluador_rut, tipo_evaluacion, puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental, comentarios } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO evaluaciones (rut_jugador, evaluador_rut, fecha_evaluacion, tipo_evaluacion, puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental, comentarios)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [rut_jugador, evaluador_rut, tipo_evaluacion, puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental, comentarios]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 17. ENDPOINTS: GAMIFICACIÓN (FASE 2)
// ==========================================

// GET: Puntos de un jugador
app.get('/api/gamificacion/:rut', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM gamificacion_puntos WHERE rut_jugador = $1 ORDER BY fecha_logro DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear logro/puntos
app.post('/api/gamificacion', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 18. ENDPOINTS: MARCAS/RÉCORDS (FASE 2)
// ==========================================

// GET: Marcas de un jugador
app.get('/api/marcas/:rut', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM marcas_tiempo WHERE rut_jugador = $1 ORDER BY fecha_marca DESC`,
      [req.params.rut]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Registrar marca
app.post('/api/marcas', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 19. ENDPOINTS: RESULTADOS (FASE 2)
// ==========================================

// GET: Resultado de un partido
app.get('/api/resultados/partido/:partidoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM resultados WHERE id_partido = $1`,
      [req.params.partidoId]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear resultado
app.post('/api/resultados', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 20. ENDPOINTS: QUIZ (FASE 2)
// ==========================================

// GET: Todas las preguntas
app.get('/api/quiz', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM quiz_preguntas WHERE activo = true ORDER BY dificultad ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pregunta
app.post('/api/quiz', async (req, res) => {
  const { titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO quiz_preguntas (titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [titulo, tipo_quiz, rama, pregunta, JSON.stringify(opciones_json), respuesta_correcta, dificultad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 21. ENDPOINTS: PIZARRA TÁCTICA (FASE 2)
// ==========================================

// GET: Tácticas de un partido
app.get('/api/pizarra/partido/:partidoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pizarra_tactica WHERE id_partido = $1 ORDER BY fecha_tactica DESC`,
      [req.params.partidoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear táctica
app.post('/api/pizarra', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 22. ENDPOINTS: MIGRACIÓN PAGOS (FASE 2)
// ==========================================

// GET: Pagos migrados
app.get('/api/migracion-pagos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM migracion_pagos ORDER BY fecha_migracion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear registro de migración
app.post('/api/migracion-pagos', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 23. ENDPOINTS: JUGADORES VISITA (FASE 2)
// ==========================================

// GET: Jugadores en visita/prueba
app.get('/api/jugadores-visita', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jugadores_visita ORDER BY fecha_visita DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Registrar jugador en visita
app.post('/api/jugadores-visita', async (req, res) => {
  const { rut_visita, nombres, apellido_paterno, apellido_materno, club_procedencia, rama, categoria, posicion, contacto_apoderado, telefono_contacto } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO jugadores_visita (rut_visita, nombres, apellido_paterno, apellido_materno, club_procedencia, rama, categoria, posicion, contacto_apoderado, telefono_contacto, fecha_visita)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE)
       RETURNING *`,
      [rut_visita, nombres, apellido_paterno, apellido_materno, club_procedencia, rama, categoria, posicion, contacto_apoderado, telefono_contacto]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar resultado de prueba
app.put('/api/jugadores-visita/:id', async (req, res) => {
  const { prueba_realizada, resultado_prueba, reclutado, observaciones } = req.body;
  try {
    const result = await pool.query(
      `UPDATE jugadores_visita 
       SET prueba_realizada = $1, resultado_prueba = $2, reclutado = $3, observaciones = $4, updated_at = NOW()
       WHERE id_visita = $5
       RETURNING *`,
      [prueba_realizada, resultado_prueba, reclutado, observaciones, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 24. ENDPOINTS: AUDITORIA (FASE 3)
// ==========================================

app.get('/api/auditoria', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM auditoria ORDER BY fecha_accion DESC LIMIT 100`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 25. ENDPOINTS: STAFF (FASE 3)
// ==========================================

app.get('/api/staff', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM staff WHERE activo = true ORDER BY apellido_paterno ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 26. ENDPOINTS: TORNEOS (FASE 3)
// ==========================================

app.get('/api/torneos', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM torneos ORDER BY fecha_inicio DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/torneos', async (req, res) => {
  const { nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO torneos (nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activo')
       RETURNING *`,
      [nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 27. ENDPOINTS: CAJA EVENTO (FASE 3)
// ==========================================

app.get('/api/caja-evento/:eventoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM caja_evento_kiosco WHERE id_evento = $1 ORDER BY fecha_movimiento DESC`,
      [req.params.eventoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/caja-evento', async (req, res) => {
  const { id_evento, tipo_movimiento, concepto, monto_ingreso, monto_egreso, metodo_pago, responsable } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO caja_evento_kiosco (id_evento, tipo_movimiento, concepto, monto_ingreso, monto_egreso, metodo_pago, responsable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id_evento, tipo_movimiento, concepto, monto_ingreso || 0, monto_egreso || 0, metodo_pago, responsable]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 28. ENDPOINTS: INVENTARIO (FASE 3)
// ==========================================

app.get('/api/inventario', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM catalogo_inventario ORDER BY nombre_articulo ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventario', async (req, res) => {
  const { codigo_articulo, nombre_articulo, categoria, cantidad_total, precio_unitario, ubicacion, proveedor } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO catalogo_inventario (codigo_articulo, nombre_articulo, categoria, cantidad_total, cantidad_disponible, precio_unitario, fecha_ingreso, ubicacion, proveedor)
       VALUES ($1, $2, $3, $4, $4, $5, CURRENT_DATE, $6, $7)
       RETURNING *`,
      [codigo_articulo, nombre_articulo, categoria, cantidad_total, precio_unitario, ubicacion, proveedor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 29. ENDPOINTS: EGRESOS (FASE 3)
// ==========================================

app.get('/api/egresos', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM egresos ORDER BY fecha_egreso DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/egresos', async (req, res) => {
  const { concepto, categoria, monto_egreso, responsable, observaciones } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO egresos (fecha_egreso, concepto, categoria, monto_egreso, responsable, estado, observaciones)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, 'pendiente', $5)
       RETURNING *`,
      [concepto, categoria, monto_egreso, responsable, observaciones]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 30. ENDPOINTS: CLUBES (FASE 3)
// ==========================================

app.get('/api/clubes', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM clubes WHERE activo = true ORDER BY nombre_club ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clubes', async (req, res) => {
  const { nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO clubes (nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club, fecha_registro)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       RETURNING *`,
      [nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 31. ENDPOINTS: LESIONES (FASE 3)
// ==========================================

app.get('/api/lesiones', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, j.nombres, j.apellido_paterno
       FROM lesiones l
       LEFT JOIN jugadores j ON l.rut_jugador = j.rut_jugador
       ORDER BY l.fecha_lesion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lesiones', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 32. ENDPOINTS: DISCIPLINA (FASE 3)
// ==========================================

app.get('/api/disciplina', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, j.nombres, j.apellido_paterno
       FROM disciplina d
       LEFT JOIN jugadores j ON d.rut_jugador = j.rut_jugador
       ORDER BY d.fecha_sancion DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/disciplina', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 33. ENDPOINTS: ENTRENAMIENTOS (FASE 3)
// ==========================================

app.get('/api/entrenamientos', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM entrenamientos ORDER BY fecha_entrenamiento DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entrenamientos', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 34. ENDPOINTS: ENCUESTAS RESPUESTAS (FASE 3)
// ==========================================

app.get('/api/encuestas/:encuestaId/respuestas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM encuestas_respuestas WHERE id_encuesta = $1 ORDER BY fecha_respuesta DESC`,
      [req.params.encuestaId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/encuestas/:encuestaId/respuesta', async (req, res) => {
  const { rut_respondente, opcion_seleccionada, comentario_adicional } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO encuestas_respuestas (id_encuesta, rut_respondente, opcion_seleccionada, comentario_adicional)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.encuestaId, rut_respondente, opcion_seleccionada, comentario_adicional]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 35. ENDPOINTS: ASISTENCIA EVENTOS DETALLE (FASE 3)
// ==========================================

app.get('/api/asistencia-eventos/:eventoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM asistencia_eventos_detalle WHERE id_evento = $1 ORDER BY fecha_confirmacion DESC`,
      [req.params.eventoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/asistencia-eventos', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️  Base de datos: ${process.env.DATABASE_URL ? 'Conectada ✓' : 'No configurada ✗'}\n`);

  ensureSuperAdminAccount().catch((error) => {
    console.error('❌ Error asegurando super admin:', error.message);
  });
});

module.exports = app;
