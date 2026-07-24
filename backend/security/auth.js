const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { obtenerPermisosEfectivos, normalizarRol } = require('./accessControl');

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$/;
const TOKEN_EXPIRES_IN = '8h';

const getJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('Falta JWT_SECRET en variables de entorno.');
  }
  return secret;
};

const isBcryptHash = (value = '') => BCRYPT_HASH_PATTERN.test(String(value || ''));

const hashPassword = async (plain) => bcrypt.hash(String(plain), 10);

// Devuelve { valid, needsRehash } — needsRehash=true cuando la contraseña
// almacenada todavía está en texto plano (cuentas legadas) y coincidió,
// para que el caller la re-hashee de forma transparente en ese mismo login.
const verifyPassword = async (plain, stored) => {
  const plainStr = String(plain ?? '');
  const storedStr = String(stored ?? '');
  if (!storedStr) return { valid: false, needsRehash: false };

  if (isBcryptHash(storedStr)) {
    const valid = await bcrypt.compare(plainStr, storedStr);
    return { valid, needsRehash: false };
  }

  const valid = plainStr === storedStr;
  return { valid, needsRehash: valid };
};

const signToken = ({ id, rut, rol }) => jwt.sign(
  { id, rut, rol: normalizarRol(rol) },
  getJwtSecret(),
  { expiresIn: TOKEN_EXPIRES_IN }
);

const authenticate = (req, res, next) => {
  const header = String(req.headers.authorization || '');
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.actor = {
      id: payload.id ?? null,
      rut: payload.rut || '',
      rol: normalizarRol(payload.rol),
    };
    return next();
  } catch (err) {
    const expirado = err.name === 'TokenExpiredError';
    return res.status(401).json({ error: expirado ? 'Sesión expirada.' : 'Token inválido.' });
  }
};

// Como authenticate, pero nunca bloquea: si no hay token o es inválido,
// req.actor queda null y la ruta sigue (para endpoints que deben servir
// contenido público a la vez que dan más visibilidad a quien sí tiene sesión
// — ej. GET /api/comunicaciones, que alimenta el feed público de noticias
// pero también las publicaciones de Academia, que no deben ser públicas).
const authenticateOpcional = (req, res, next) => {
  const header = String(req.headers.authorization || '');
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    req.actor = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.actor = {
      id: payload.id ?? null,
      rut: payload.rut || '',
      rol: normalizarRol(payload.rol),
    };
  } catch {
    req.actor = null;
  }
  return next();
};

const requireRole = (...roles) => {
  const permitidos = new Set(roles.map((rol) => normalizarRol(rol)));
  return (req, res, next) => {
    const actor = req.actor;
    if (!actor || !permitidos.has(actor.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
    }
    return next();
  };
};

// El JWT solo lleva {id, rut, rol} (ver signToken/authenticate arriba) — el
// permisos_override por cuenta (JSONB en cuentas, editable desde el panel de
// SuperAdmin) vive en la BD y hay que resolverlo en cada request. poolRef se
// inyecta una sola vez desde server.js via setPool(pool) al arrancar, para no
// tener que cambiar la firma de requireModule('id') en sus ~30 usos actuales.
let poolRef = null;
const setPool = (poolInstance) => { poolRef = poolInstance; };

const obtenerOverrideDeCuenta = async (rut) => {
  const rutLimpio = String(rut || '').trim();
  if (!poolRef || !rutLimpio) return {};
  try {
    const result = await poolRef.query('SELECT permisos_override FROM cuentas WHERE rut = $1', [rutLimpio]);
    return result.rows[0]?.permisos_override || {};
  } catch (err) {
    console.error('❌ Error resolviendo permisos_override:', err.message);
    return {};
  }
};

// Único punto de resolución de los permisos "reales" de un actor autenticado
// (rol base + su override individual). Úsalo en vez de llamar
// obtenerPermisosEfectivos({rol}) directo en cualquier código nuevo que
// necesite respetar el override configurado por un admin.
const resolverPermisosDeActor = async (actor) => obtenerPermisosEfectivos({
  rol: actor?.rol,
  override: await obtenerOverrideDeCuenta(actor?.rut),
});

const requireModule = (moduloId) => async (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const permisos = await resolverPermisosDeActor(actor);
  if (!permisos[moduloId]) {
    return res.status(403).json({ error: 'No tienes acceso a este módulo.' });
  }
  return next();
};

// Permite el acceso si el actor tiene AL MENOS UNO de los módulos dados
// (recursos compartidos por varios roles, ej. el roster de jugadores lo
// consultan tanto admin_dashboard como asistencia_staff/evaluacion_staff).
const requireAnyModule = (...moduloIds) => async (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const permisos = await resolverPermisosDeActor(actor);
  if (!moduloIds.some((moduloId) => permisos[moduloId])) {
    return res.status(403).json({ error: 'No tienes acceso a este módulo.' });
  }
  return next();
};

// Permite el acceso si el actor es dueño del recurso (mismo id de cuenta
// numérico, req.actor.id, que el parámetro de ruta) o si tiene el módulo
// administrativo dado, para rutas tipo /api/recurso/:usuarioId.
const requireOwnerIdOrModule = (paramName, moduloId) => async (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const idParametro = String(req.params[paramName] || '').trim();
  const esDueno = idParametro && String(actor.id) === idParametro;
  if (esDueno) return next();

  const permisos = await resolverPermisosDeActor(actor);
  if (!permisos[moduloId]) {
    return res.status(403).json({ error: 'No tienes acceso a este recurso.' });
  }
  return next();
};

// Para rutas de "dueño o módulo admin" (ver requireOwnerIdOrModule):
// si quien llama entró solo por ser el dueño (no tiene el módulo admin), se
// eliminan del body los campos privilegiados antes de que lleguen al handler,
// para que un usuario no pueda auto-asignarse rol, permisos o condiciones de pago.
const stripFieldsUnlessModule = (fields, moduloId) => async (req, res, next) => {
  const actor = req.actor;
  if (!actor) return next();

  const permisos = await resolverPermisosDeActor(actor);
  if (permisos[moduloId]) return next();

  if (req.body && typeof req.body === 'object') {
    fields.forEach((campo) => {
      delete req.body[campo];
    });
  }
  return next();
};

const normalizarRutParaComparar = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();

// Permite el acceso a /api/jugadores/:rut si el actor tiene el módulo admin dado,
// o si su RUT coincide con el rut_apoderado registrado del jugador (apoderado
// editando el perfil de su propio pupilo). Consulta la tabla en cada request
// para reflejar reasignaciones de apoderado sin depender del token.
const requireApoderadoDeJugadorOModule = (pool, moduloId) => async (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const permisos = await resolverPermisosDeActor(actor);
  if (permisos[moduloId]) return next();

  const rutJugador = String(req.params.rut || '').trim();
  const rutActor = normalizarRutParaComparar(actor.rut);
  if (!rutJugador || !rutActor) {
    return res.status(403).json({ error: 'No tienes acceso a este recurso.' });
  }

  pool.query('SELECT rut_apoderado FROM jugadores WHERE rut_jugador = $1', [rutJugador])
    .then((result) => {
      const rutApoderadoRegistrado = normalizarRutParaComparar(result.rows[0]?.rut_apoderado || '');
      if (rutApoderadoRegistrado && rutApoderadoRegistrado === rutActor) {
        req.esApoderadoDueno = true;
        return next();
      }
      return res.status(403).json({ error: 'No tienes acceso a este recurso.' });
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

// Exige que el actor sea el apoderado registrado (rut_apoderado) del jugador
// indicado por :rut en la ruta — sin bypass de módulo administrativo. Se usa
// para la confirmación/rechazo de citaciones, que el club pidió reservar
// exclusivamente a apoderados (ni siquiera admin/staff responde en su lugar).
// Edad en años cumplidos a partir de una fecha de nacimiento (DATE/timestamp
// de Postgres o string parseable). Null si no hay fecha válida — nunca se
// asume una edad a partir de un dato ausente.
const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const aunNoCumpleEsteAnio = (
    hoy.getUTCMonth() < nacimiento.getUTCMonth()
    || (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() < nacimiento.getUTCDate())
  );
  if (aunNoCumpleEsteAnio) edad -= 1;
  return edad;
};

const EDAD_MINIMA_RESPUESTA_PROPIA = 13;

// Autoriza el RSVP de una citación a: (a) el apoderado registrado del
// deportista (como siempre), o (b) el propio deportista si ya tiene 13 años
// o más (regla de negocio: bajo esa edad, solo responde el apoderado).
const requireApoderadoDeJugador = (pool) => (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const rutJugador = String(req.params.rut || '').trim();
  const rutActor = normalizarRutParaComparar(actor.rut);
  if (!rutJugador || !rutActor) {
    return res.status(403).json({ error: 'No tienes acceso a este recurso.' });
  }

  pool.query('SELECT rut_apoderado, fecha_nacimiento FROM jugadores WHERE rut_jugador = $1', [rutJugador])
    .then((result) => {
      const fila = result.rows[0] || {};
      const rutApoderadoRegistrado = normalizarRutParaComparar(fila.rut_apoderado || '');
      if (rutApoderadoRegistrado && rutApoderadoRegistrado === rutActor) {
        return next();
      }

      const esElPropioJugador = normalizarRutParaComparar(rutJugador) === rutActor;
      if (esElPropioJugador) {
        const edad = calcularEdad(fila.fecha_nacimiento);
        if (edad !== null && edad >= EDAD_MINIMA_RESPUESTA_PROPIA) {
          return next();
        }
      }

      return res.status(403).json({ error: 'Solo el apoderado del deportista puede confirmar o rechazar esta citación.' });
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  authenticate,
  authenticateOpcional,
  requireRole,
  requireModule,
  requireAnyModule,
  requireOwnerIdOrModule,
  requireApoderadoDeJugadorOModule,
  requireApoderadoDeJugador,
  calcularEdad,
  stripFieldsUnlessModule,
  isBcryptHash,
  normalizarRutParaComparar,
  setPool,
  resolverPermisosDeActor,
};
