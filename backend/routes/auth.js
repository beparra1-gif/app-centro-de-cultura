// Rutas de autenticación: login, códigos de acceso/activación, cambio de clave, consentimiento de datos y verificación de correo propio.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { hashPassword, verifyPassword, signToken, normalizarRutParaComparar, calcularEdad, authenticate, requireModule } = require('../security/auth');
const { correoDisponible, esCorreoReal, enviarCorreo, enmascararCorreo } = require('../lib/correo');
const { pool, sheetsSyncManager } = require('../lib/db');
const { formatearRut, normalizarRut } = require('../lib/rut');
const { obtenerCuentaPorRutNormalizado, provisionarCuentaJugadorSiCorresponde } = require('../lib/cuentas');

const router = express.Router();

// ==========================================
// AUTH: LOGIN BÁSICO POR RUT/PASSWORD
// ==========================================
// skipSuccessfulRequests: solo cuentan los intentos fallidos — antes 10
// logins CORRECTOS seguidos también agotaban el cupo.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

// Antes compartía authRateLimiter con /login: una familia equivocándose al
// escribir la clave nueva durante el cambio obligatorio de contraseña podía
// agotar el cupo y quedar bloqueada también para volver a iniciar sesión.
// Limiter propio, más holgado, porque acá no hay riesgo de fuerza bruta de
// credenciales (requiere ya conocer la contraseña actual).
const changePasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

router.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { rut, password } = req.body;

  if (!rut || !password) {
    return res.status(400).json({ error: 'rut y password son obligatorios' });
  }

  try {
    const rutNormalizado = normalizarRut(rut);
    let cuentaFinal = await obtenerCuentaPorRutNormalizado(rutNormalizado);

    if (!cuentaFinal && String(password) === CLAVE_INICIAL_LEGADA && !claveInicialPermitida()) {
      return res.status(403).json({ error: MENSAJE_CLAVE_INICIAL_CERRADA, code: 'CLAVE_INICIAL_CERRADA' });
    }

    if (!cuentaFinal) {
      const cuentaProvisionada = await provisionarCuentaJugadorSiCorresponde({ rutNormalizado, password });
      if (!cuentaProvisionada) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      cuentaFinal = cuentaProvisionada;
    }

    const cuenta = cuentaFinal;
    if (cuenta.estado && String(cuenta.estado).toLowerCase() !== 'activo') {
      return res.status(403).json({ error: 'Cuenta inactiva' });
    }

    const rolDb = String(cuenta.rol || '').toLowerCase();
    const esJugador = rolDb === 'jugador';

    if (!String(cuenta.password || '').trim() && esJugador && String(password || '') === '12345') {
      const passwordHashDefault = await hashPassword('12345');
      await pool.query(
        `UPDATE cuentas
         SET password = $2,
             forzar_clave = true,
             updated_at = NOW()
         WHERE id = $1`,
        [cuenta.id, passwordHashDefault]
      );
      cuentaFinal = await obtenerCuentaPorRutNormalizado(rutNormalizado);
    }

    const { valid, needsRehash } = await verifyPassword(password, cuentaFinal.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Con correo real cargado, la clave inicial "12345" o una clave marcada
    // para cambio (forzar_clave: reseteada por un admin o expuesta en la
    // planilla) ya no dan acceso: se envía un código al correo y la persona
    // crea su contraseña con él. Sin correo, sigue el flujo anterior.
    const debeUsarCodigo = esCorreoReal(cuentaFinal.correo)
      && correoDisponible()
      && (String(password) === CLAVE_INICIAL_LEGADA || Boolean(cuentaFinal.forzar_clave));
    if (debeUsarCodigo) {
      const envio = await generarYEnviarCodigoAcceso(cuentaFinal);
      return res.status(403).json({
        error: `Por seguridad, crea tu contraseña con el código que enviamos a ${envio.destino}.`,
        code: 'USAR_CODIGO_CORREO',
        destino: envio.destino,
      });
    }

    // Sin correo: la clave inicial y las claves marcadas para cambio (forzar_clave,
    // incluidas las que quedaron expuestas) ya no dan acceso pasada la fecha de
    // transición; la persona pide un código de activación al club (WhatsApp).
    if (!claveInicialPermitida() && (String(password) === CLAVE_INICIAL_LEGADA || Boolean(cuentaFinal.forzar_clave))) {
      return res.status(403).json({ error: MENSAJE_CLAVE_INICIAL_CERRADA, code: 'CLAVE_INICIAL_CERRADA' });
    }

    if (needsRehash) {
      const passwordHash = await hashPassword(password);
      await pool.query(
        `UPDATE cuentas SET password = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, cuentaFinal.id]
      );
    }

    const rolSistema = rolDb === 'super_admin' || rolDb === 'superadmin' ? 'super_admin' : rolDb || 'jugador';
    const token = signToken({ id: cuentaFinal.id, rut: formatearRut(cuentaFinal.rut), rol: rolSistema });

    res.json({
      ok: true,
      token,
      user: {
        id: cuentaFinal.id,
        nombre: `${cuentaFinal.nombres || ''} ${cuentaFinal.apellido_paterno || ''}`.trim() || cuentaFinal.correo,
        correo: cuentaFinal.correo,
        rut: formatearRut(cuentaFinal.rut),
        rol: rolSistema,
        perfil_principal: cuentaFinal.perfil_principal || rolSistema,
        forzar_clave: Boolean(cuentaFinal.forzar_clave),
        foto_perfil_url: cuentaFinal.foto_perfil_url || null,
        requiere_foto_perfil: Boolean(cuentaFinal.requiere_foto_perfil),
        // Pasos obligatorios del primer ingreso (aviso de datos y correo).
        consentimiento_version: cuentaFinal.consentimiento_version || null,
        correo_registrado: esCorreoReal(cuentaFinal.correo),
        correo_disponible: correoDisponible(),
        access_profiles: rolSistema === 'super_admin'
          ? ['super_admin', 'admin', 'staff', 'mesa', 'jugador', 'visita']
          : [rolSistema]
      }
    });
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AUTH: CÓDIGO DE ACCESO POR CORREO
// ==========================================
// Primer ingreso y "Olvidé mi contraseña": se envía un código de 6 dígitos al
// correo registrado de la cuenta. Reemplaza la clave inicial "12345" (que
// cualquiera con el RUT podía usar) y las claves que quedaron expuestas en la
// planilla pública, para toda cuenta que tenga un correo real cargado.
const CODIGO_MINUTOS_VIGENCIA = 15;
const CODIGO_MAX_INTENTOS = 5;
const CODIGO_SEGUNDOS_ENTRE_ENVIOS = 60;
const CLAVE_INICIAL_LEGADA = '12345';

// Cierre de la clave inicial "12345" (y de claves forzar_clave) para cuentas
// SIN correo. CLAVE_INICIAL_HASTA=AAAA-MM-DD mantiene el acceso anterior
// hasta ese día inclusive (transición anunciada); sin la variable queda
// cerrada. Las cuentas con correo ya usan el código por correo.
const claveInicialPermitida = () => {
  const hasta = String(process.env.CLAVE_INICIAL_HASTA || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return false;
  const hoyChile = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  return hoyChile <= hasta;
};
const MENSAJE_CLAVE_INICIAL_CERRADA = 'La clave inicial ya no está habilitada. Pide al club tu código de activación (te llega por WhatsApp) e ingrésalo en "¿Primera vez u olvidaste tu contraseña?" → "Tengo un código del club".';

const codigoRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de código. Espera unos minutos e inténtalo de nuevo.' },
});

// Crea un código de 6 dígitos (guardado con hash) e invalida los anteriores
// pendientes del mismo propósito. Devuelve el código en claro SOLO a quien
// lo va a entregar (correo o admin); nunca se vuelve a poder leer.
const crearCodigo = async ({ cuentaId, proposito, minutos, correoDestino = null, creadoPor = null }) => {
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const codigoHash = await hashPassword(codigo);
  await pool.query(
    'UPDATE codigos_acceso SET usado_en = NOW() WHERE cuenta_id = $1 AND proposito = $2 AND usado_en IS NULL',
    [cuentaId, proposito]
  );
  const insertado = await pool.query(
    `INSERT INTO codigos_acceso (cuenta_id, codigo_hash, expira_en, proposito, correo_destino, creado_por)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4, $5, $6)
     RETURNING expira_en`,
    [cuentaId, codigoHash, String(minutos), proposito, correoDestino, creadoPor]
  );
  return { codigo, expiraEn: insertado.rows[0].expira_en };
};

// Devuelve { enviado, destino } — no lanza si la cuenta no tiene correo.
const generarYEnviarCodigoAcceso = async (cuenta) => {
  if (!cuenta?.id || !esCorreoReal(cuenta.correo)) return { enviado: false, destino: null };
  const destino = enmascararCorreo(cuenta.correo);

  const reciente = await pool.query(
    `SELECT 1 FROM codigos_acceso
     WHERE cuenta_id = $1 AND proposito = 'acceso' AND creado_por IS NULL AND usado_en IS NULL
       AND creado_en > NOW() - ($2 || ' seconds')::interval
     LIMIT 1`,
    [cuenta.id, String(CODIGO_SEGUNDOS_ENTRE_ENVIOS)]
  );
  if (reciente.rows.length > 0) return { enviado: true, destino, reenvioReciente: true };

  const { codigo } = await crearCodigo({ cuentaId: cuenta.id, proposito: 'acceso', minutos: CODIGO_MINUTOS_VIGENCIA });

  const nombre = String(cuenta.nombres || '').trim().split(' ')[0] || '';
  const saludo = nombre ? `Hola ${nombre}:` : 'Hola:';
  await enviarCorreo({
    para: cuenta.correo,
    asunto: `Tu código de acceso: ${codigo}`,
    texto: `${saludo}\n\nTu código para crear tu contraseña en la app del Club Centro de Cultura Física es: ${codigo}\n\nVence en ${CODIGO_MINUTOS_VIGENCIA} minutos. Si no lo pediste, ignora este correo: tu cuenta sigue segura.\n`,
    html: `<p>${saludo}</p><p>Tu código para crear tu contraseña en la app del Club Centro de Cultura Física es:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${codigo}</p><p>Vence en ${CODIGO_MINUTOS_VIGENCIA} minutos. Si no lo pediste, ignora este correo: tu cuenta sigue segura.</p>`,
  });
  return { enviado: true, destino };
};

router.post('/api/auth/solicitar-codigo', codigoRateLimiter, async (req, res) => {
  const rut = String(req.body?.rut || '').trim();
  if (!rut) return res.status(400).json({ error: 'Ingresa tu RUT.' });
  // Sin SMTP: 200 con enviado=false (no 503: DigitalOcean reemplaza las
  // respuestas 503 por su propia página de error y el frontend no recibiría
  // este mensaje ni mostraría el botón de WhatsApp).
  if (!correoDisponible()) {
    return res.json({
      ok: false,
      enviado: false,
      code: 'CORREO_NO_CONFIGURADO',
      mensaje: 'Por ahora el club no envía códigos por correo. Pide tu código de activación al club por WhatsApp y úsalo en "Tengo un código del club".',
    });
  }
  try {
    const cuenta = await obtenerCuentaPorRutNormalizado(normalizarRut(rut));
    const activa = cuenta && (!cuenta.estado || String(cuenta.estado).toLowerCase() === 'activo');
    const resultado = activa ? await generarYEnviarCodigoAcceso(cuenta) : { enviado: false, destino: null };
    if (!resultado.enviado) {
      return res.json({
        ok: true,
        enviado: false,
        mensaje: 'No encontramos un correo registrado para ese RUT. Contacta al club para que lo agregue a tu cuenta.',
      });
    }
    return res.json({
      ok: true,
      enviado: true,
      destino: resultado.destino,
      mensaje: `Te enviamos un código de 6 dígitos a ${resultado.destino}. Revisa también la carpeta de spam.`,
    });
  } catch (err) {
    console.error('[POST /api/auth/solicitar-codigo]', err);
    return res.status(500).json({ error: 'No se pudo enviar el código. Inténtalo de nuevo en unos minutos.' });
  }
});

router.post('/api/auth/canjear-codigo', authRateLimiter, async (req, res) => {
  const rut = String(req.body?.rut || '').trim();
  const codigo = String(req.body?.codigo || '').replace(/\D/g, '');
  const nuevaClave = String(req.body?.nuevaClave || '').trim();
  if (!rut || codigo.length !== 6) return res.status(400).json({ error: 'Ingresa el código de 6 dígitos que llegó a tu correo.' });
  if (nuevaClave.length < 5) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 5 caracteres.' });
  if (nuevaClave === CLAVE_INICIAL_LEGADA) return res.status(400).json({ error: 'Elige una contraseña distinta a la clave inicial.' });

  try {
    const cuenta = await obtenerCuentaPorRutNormalizado(normalizarRut(rut));
    const pendiente = cuenta?.id ? (await pool.query(
      `SELECT id, codigo_hash, intentos FROM codigos_acceso
       WHERE cuenta_id = $1 AND proposito = 'acceso' AND usado_en IS NULL AND expira_en > NOW()
       ORDER BY id DESC LIMIT 1`,
      [cuenta.id]
    )).rows[0] : null;
    if (!pendiente) {
      return res.status(400).json({ error: 'El código venció o ya se usó. Pide uno nuevo.' });
    }
    if (pendiente.intentos >= CODIGO_MAX_INTENTOS) {
      await pool.query('UPDATE codigos_acceso SET usado_en = NOW() WHERE id = $1', [pendiente.id]);
      return res.status(429).json({ error: 'Demasiados intentos con ese código. Pide uno nuevo.' });
    }
    const { valid } = await verifyPassword(codigo, pendiente.codigo_hash);
    if (!valid) {
      await pool.query('UPDATE codigos_acceso SET intentos = intentos + 1 WHERE id = $1', [pendiente.id]);
      const restantes = CODIGO_MAX_INTENTOS - pendiente.intentos - 1;
      return res.status(400).json({ error: `Código incorrecto. Te quedan ${Math.max(0, restantes)} intento${restantes === 1 ? '' : 's'}.` });
    }

    await pool.query(
      'UPDATE cuentas SET password = $1, forzar_clave = false, updated_at = NOW() WHERE id = $2',
      [await hashPassword(nuevaClave), cuenta.id]
    );
    await pool.query("UPDATE codigos_acceso SET usado_en = NOW() WHERE cuenta_id = $1 AND proposito = 'acceso' AND usado_en IS NULL", [cuenta.id]);
    return res.json({ ok: true, mensaje: 'Listo: tu nueva contraseña quedó guardada. Ya puedes ingresar.' });
  } catch (err) {
    console.error('[POST /api/auth/canjear-codigo]', err);
    return res.status(500).json({ error: 'No se pudo guardar la nueva contraseña. Inténtalo de nuevo.' });
  }
});

// Tramo de edad del titular (art. 16 quáter Ley 19.628 mod. por Ley 21.719):
// menores de 14 → consiente su madre/padre/apoderado; 14–15 → consiente sus
// datos pero no los sensibles (salud); 16–17 y adultos → todo. Solo aplica a
// la persona cuya ficha de deportista tiene el mismo RUT que la cuenta; un
// deportista sin fecha de nacimiento se trata con la regla más protectora.
const tramoConsentimientoDeActor = async (actor) => {
  const rut = normalizarRutParaComparar(actor?.rut || '');
  if (!rut) return { tramo: 'adulto', edad: null };
  const ficha = (await pool.query(
    "SELECT fecha_nacimiento FROM jugadores WHERE REPLACE(REPLACE(UPPER(rut_jugador), '.', ''), '-', '') = $1 LIMIT 1",
    [rut]
  )).rows[0];
  if (!ficha) return { tramo: 'adulto', edad: null };
  const edad = calcularEdad(ficha.fecha_nacimiento);
  if (edad === null || edad < 14) return { tramo: 'nino', edad };
  if (edad < 16) return { tramo: 'adolescente14', edad };
  if (edad < 18) return { tramo: 'adolescente16', edad };
  return { tramo: 'adulto', edad };
};

router.get('/api/consentimiento/estado', authenticate, async (req, res) => {
  try {
    const idCuenta = Number.parseInt(String(req.actor?.id ?? ''), 10);
    const cuenta = Number.isFinite(idCuenta)
      ? (await pool.query('SELECT consentimiento_version, consentimiento_aceptado_en FROM cuentas WHERE id = $1', [idCuenta])).rows[0]
      : null;
    const { tramo, edad } = await tramoConsentimientoDeActor(req.actor);
    return res.json({
      tramo,
      edad,
      version_aceptada: cuenta?.consentimiento_version || null,
      aceptado_en: cuenta?.consentimiento_aceptado_en || null,
    });
  } catch (err) {
    console.error('[GET /api/consentimiento/estado]', err);
    return res.status(500).json({ error: 'No se pudo consultar el estado del aviso.' });
  }
});

router.post('/api/consentimiento', authenticate, async (req, res) => {
  const idCuenta = Number.parseInt(String(req.actor?.id ?? ''), 10);
  const version = String(req.body?.version || '').trim().slice(0, 40);
  if (!Number.isFinite(idCuenta)) return res.status(400).json({ error: 'Cuenta no válida.' });
  if (!version) return res.status(400).json({ error: 'Falta la versión del aviso.' });

  try {
    const { tramo, edad } = await tramoConsentimientoDeActor(req.actor);
    let aceptaTratamiento = req.body?.acepta_tratamiento === true;
    let aceptaSalud = req.body?.acepta_datos_salud === true;
    let autorizaImagen = req.body?.autoriza_imagen === true;
    let tipoRegistro = 'consentimiento';

    if (tramo === 'nino') {
      // Menor de 14: no consiente por sí mismo; solo deja constancia de que
      // fue informado. El consentimiento lo otorga su madre/padre/apoderado.
      if (req.body?.declara_lectura !== true) {
        return res.status(400).json({ error: 'Marca que leíste el aviso para continuar.' });
      }
      aceptaTratamiento = false;
      aceptaSalud = false;
      autorizaImagen = false;
      tipoRegistro = 'lectura_menor_14';
    } else if (tramo === 'adolescente14') {
      if (!aceptaTratamiento) return res.status(400).json({ error: 'Para usar la aplicación debes aceptar el tratamiento de tus datos.' });
      // Datos de salud de menores de 16: los autoriza su apoderado, no él.
      aceptaSalud = false;
      tipoRegistro = 'consentimiento_14_15';
    } else if (!aceptaTratamiento || !aceptaSalud) {
      return res.status(400).json({ error: 'Para usar la aplicación debes aceptar el tratamiento de datos y de datos de salud.' });
    }

    await pool.query(
      `INSERT INTO consentimientos_datos (cuenta_id, version, acepta_tratamiento, acepta_datos_salud, autoriza_imagen, ip, user_agent, tipo_registro, edad_titular)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [idCuenta, version, aceptaTratamiento, aceptaSalud, autorizaImagen, req.ip || null,
        String(req.headers['user-agent'] || '').slice(0, 400), tipoRegistro, edad]
    );
    await pool.query(
      `UPDATE cuentas SET consentimiento_version = $1, consentimiento_aceptado_en = NOW(),
         autorizacion_imagen = CASE WHEN $4 THEN autorizacion_imagen ELSE $2 END, updated_at = NOW()
       WHERE id = $3`,
      [version, autorizaImagen, idCuenta, tramo === 'nino']
    );
    return res.json({ ok: true, version, tramo });
  } catch (err) {
    console.error('[POST /api/consentimiento]', err);
    return res.status(500).json({ error: 'No se pudo registrar la aceptación. Inténtalo de nuevo.' });
  }
});

// ==========================================
// CORREO PROPIO: registrar y verificar (primer ingreso)
// ==========================================
// El dueño de la cuenta no puede cambiar su correo con PUT /api/cuentas/:id
// (sería "adoptar" pupilos ajenos vía correo_apoderado). Aquí sí puede, pero
// solo después de demostrar que recibe correo en esa dirección (código).
router.post('/api/cuentas/propia/correo/solicitar', codigoRateLimiter, authenticate, async (req, res) => {
  const idCuenta = Number.parseInt(String(req.actor?.id ?? ''), 10);
  const correo = String(req.body?.correo || '').trim().toLowerCase();
  if (!Number.isFinite(idCuenta)) return res.status(400).json({ error: 'Cuenta no válida.' });
  if (!esCorreoReal(correo)) return res.status(400).json({ error: 'Ingresa un correo válido.' });
  if (!correoDisponible()) return res.status(409).json({ error: 'El envío de correos no está disponible por ahora.', code: 'CORREO_NO_CONFIGURADO' });
  try {
    const ocupado = await pool.query('SELECT 1 FROM cuentas WHERE LOWER(correo) = $1 AND id <> $2 LIMIT 1', [correo, idCuenta]);
    if (ocupado.rows.length > 0) {
      return res.status(409).json({ error: 'Ese correo ya está registrado en otra cuenta. Si es tuyo, contacta al club.' });
    }
    const { codigo } = await crearCodigo({ cuentaId: idCuenta, proposito: 'verificar_correo', minutos: CODIGO_MINUTOS_VIGENCIA, correoDestino: correo });
    await enviarCorreo({
      para: correo,
      asunto: `Confirma tu correo: ${codigo}`,
      texto: `Tu código para confirmar este correo en la app del Club Centro de Cultura Física es: ${codigo}\n\nVence en ${CODIGO_MINUTOS_VIGENCIA} minutos. Si no lo pediste, ignora este mensaje.\n`,
      html: `<p>Tu código para confirmar este correo en la app del Club Centro de Cultura Física es:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${codigo}</p><p>Vence en ${CODIGO_MINUTOS_VIGENCIA} minutos. Si no lo pediste, ignora este mensaje.</p>`,
    });
    return res.json({ ok: true, destino: enmascararCorreo(correo) });
  } catch (err) {
    console.error('[POST /api/cuentas/propia/correo/solicitar]', err);
    return res.status(500).json({ error: 'No se pudo enviar el código. Inténtalo de nuevo.' });
  }
});

router.post('/api/cuentas/propia/correo/confirmar', authRateLimiter, authenticate, async (req, res) => {
  const idCuenta = Number.parseInt(String(req.actor?.id ?? ''), 10);
  const codigo = String(req.body?.codigo || '').replace(/\D/g, '');
  if (!Number.isFinite(idCuenta) || codigo.length !== 6) return res.status(400).json({ error: 'Ingresa el código de 6 dígitos.' });
  try {
    const pendiente = (await pool.query(
      `SELECT id, codigo_hash, intentos, correo_destino FROM codigos_acceso
       WHERE cuenta_id = $1 AND proposito = 'verificar_correo' AND usado_en IS NULL AND expira_en > NOW()
       ORDER BY id DESC LIMIT 1`,
      [idCuenta]
    )).rows[0];
    if (!pendiente) return res.status(400).json({ error: 'El código venció. Pide uno nuevo.' });
    if (pendiente.intentos >= CODIGO_MAX_INTENTOS) {
      await pool.query('UPDATE codigos_acceso SET usado_en = NOW() WHERE id = $1', [pendiente.id]);
      return res.status(429).json({ error: 'Demasiados intentos con ese código. Pide uno nuevo.' });
    }
    const { valid } = await verifyPassword(codigo, pendiente.codigo_hash);
    if (!valid) {
      await pool.query('UPDATE codigos_acceso SET intentos = intentos + 1 WHERE id = $1', [pendiente.id]);
      return res.status(400).json({ error: 'Código incorrecto.' });
    }
    await pool.query('UPDATE cuentas SET correo = $1, updated_at = NOW() WHERE id = $2', [pendiente.correo_destino, idCuenta]);
    await pool.query('UPDATE codigos_acceso SET usado_en = NOW() WHERE id = $1', [pendiente.id]);
    sheetsSyncManager.enqueueTable('cuentas');
    return res.json({ ok: true, correo: pendiente.correo_destino });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado en otra cuenta.' });
    console.error('[POST /api/cuentas/propia/correo/confirmar]', err);
    return res.status(500).json({ error: 'No se pudo confirmar el correo.' });
  }
});

// ==========================================
// CÓDIGO DE ACTIVACIÓN ENTREGADO POR EL CLUB (WhatsApp / en persona)
// ==========================================
// Para cuentas sin correo: un admin genera un código (48 h, un solo uso) y
// lo entrega por WhatsApp o en persona. Se canjea igual que el del correo
// (POST /api/auth/canjear-codigo). El código en claro se devuelve solo en
// esta respuesta; en la BD queda con hash.
const CODIGO_ACTIVACION_HORAS = 48;

router.post('/api/admin/cuentas/:id/codigo-activacion', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const idCuenta = Number.parseInt(String(req.params.id || ''), 10);
  if (!Number.isFinite(idCuenta)) return res.status(400).json({ error: 'Cuenta no válida.' });
  try {
    const cuenta = (await pool.query(
      'SELECT id, rut, nombres, apellido_paterno, correo, prefijo_tel, telefono, estado FROM cuentas WHERE id = $1',
      [idCuenta]
    )).rows[0];
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });
    const { codigo, expiraEn } = await crearCodigo({
      cuentaId: idCuenta,
      proposito: 'acceso',
      minutos: CODIGO_ACTIVACION_HORAS * 60,
      creadoPor: Number.parseInt(String(req.actor?.id ?? ''), 10) || null,
    });
    // Trazabilidad (sin el código): quién generó un acceso para quién.
    await pool.query(
      `INSERT INTO auditoria (usuario_id, tabla_afectada, tipo_accion, registro_id, valores_nuevos, descripcion, ip_usuario)
       VALUES ($1, 'cuentas', 'POST', $2, $3::jsonb, $4, $5)`,
      [
        Number.parseInt(String(req.actor?.id ?? ''), 10) || null,
        idCuenta,
        JSON.stringify({ accion: 'codigo_activacion', vigencia_horas: CODIGO_ACTIVACION_HORAS }),
        'Código de activación generado para entregar por WhatsApp/en persona',
        req.ip || null,
      ]
    ).catch((error) => console.error('[AUDITORIA] codigo_activacion:', error.message));

    const digitos = `${String(cuenta.prefijo_tel || '').replace(/\D/g, '')}${String(cuenta.telefono || '').replace(/\D/g, '')}`;
    return res.json({
      ok: true,
      codigo,
      expira_en: expiraEn,
      vigencia_horas: CODIGO_ACTIVACION_HORAS,
      rut: cuenta.rut,
      nombre: `${cuenta.nombres || ''} ${cuenta.apellido_paterno || ''}`.trim(),
      telefono: digitos,
      correo_registrado: esCorreoReal(cuenta.correo),
      cuenta_activa: !cuenta.estado || String(cuenta.estado).toLowerCase() === 'activo',
    });
  } catch (err) {
    console.error('[POST /api/admin/cuentas/:id/codigo-activacion]', err);
    return res.status(500).json({ error: 'No se pudo generar el código.' });
  }
});

router.post('/api/auth/change-password', changePasswordRateLimiter, async (req, res) => {
  const { rut, currentPassword, newPassword } = req.body;

  if (!rut || !newPassword) {
    return res.status(400).json({ error: 'rut y newPassword son obligatorios' });
  }

  const nuevaClave = String(newPassword).trim();
  if (nuevaClave.length < 5) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 5 caracteres.' });
  }

  try {
    const rutNormalizado = normalizarRut(rut);
    const result = await pool.query(
      `SELECT id, password
       FROM cuentas
       WHERE UPPER(REPLACE(REPLACE(rut, '.', ''), '-', '')) = $1
       LIMIT 1`,
      [rutNormalizado]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada.' });
    }

    const cuenta = result.rows[0];
    const { valid } = await verifyPassword(currentPassword, cuenta.password);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual no coincide.' });
    }

    const nuevaClaveHash = await hashPassword(nuevaClave);
    await pool.query(
      `UPDATE cuentas
       SET password = $1,
           forzar_clave = false,
           updated_at = NOW()
       WHERE id = $2`,
      [nuevaClaveHash, cuenta.id]
    );

    return res.json({ ok: true, message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('[POST /api/auth/change-password]', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
