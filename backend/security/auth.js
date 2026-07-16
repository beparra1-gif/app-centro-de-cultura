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

const requireModule = (moduloId) => (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const permisos = obtenerPermisosEfectivos({ rol: actor.rol });
  if (!permisos[moduloId]) {
    return res.status(403).json({ error: 'No tienes acceso a este módulo.' });
  }
  return next();
};

// Permite el acceso si el actor tiene AL MENOS UNO de los módulos dados
// (recursos compartidos por varios roles, ej. el roster de jugadores lo
// consultan tanto admin_dashboard como asistencia_staff/evaluacion_staff).
const requireAnyModule = (...moduloIds) => (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const permisos = obtenerPermisosEfectivos({ rol: actor.rol });
  if (!moduloIds.some((moduloId) => permisos[moduloId])) {
    return res.status(403).json({ error: 'No tienes acceso a este módulo.' });
  }
  return next();
};

// Permite el acceso si el actor es dueño del recurso (mismo id de cuenta
// numérico, req.actor.id, que el parámetro de ruta) o si tiene el módulo
// administrativo dado, para rutas tipo /api/recurso/:usuarioId.
const requireOwnerIdOrModule = (paramName, moduloId) => (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const idParametro = String(req.params[paramName] || '').trim();
  const esDueno = idParametro && String(actor.id) === idParametro;
  if (esDueno) return next();

  const permisos = obtenerPermisosEfectivos({ rol: actor.rol });
  if (!permisos[moduloId]) {
    return res.status(403).json({ error: 'No tienes acceso a este recurso.' });
  }
  return next();
};

// Para rutas de "dueño o módulo admin" (ver requireOwnerIdOrModule):
// si quien llama entró solo por ser el dueño (no tiene el módulo admin), se
// eliminan del body los campos privilegiados antes de que lleguen al handler,
// para que un usuario no pueda auto-asignarse rol, permisos o condiciones de pago.
const stripFieldsUnlessModule = (fields, moduloId) => (req, res, next) => {
  const actor = req.actor;
  if (!actor) return next();

  const permisos = obtenerPermisosEfectivos({ rol: actor.rol });
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
const requireApoderadoDeJugadorOModule = (pool, moduloId) => (req, res, next) => {
  const actor = req.actor;
  if (!actor) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }

  const permisos = obtenerPermisosEfectivos({ rol: actor.rol });
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

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  authenticate,
  requireRole,
  requireModule,
  requireAnyModule,
  requireOwnerIdOrModule,
  requireApoderadoDeJugadorOModule,
  stripFieldsUnlessModule,
  isBcryptHash,
};
