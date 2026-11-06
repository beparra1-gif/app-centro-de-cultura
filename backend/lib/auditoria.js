// Auditoría de cambios: mapa recurso→tabla, actor de la request y registro sanitizado.
// Extraído de server.js sin cambios de comportamiento.
const { normalizarRut } = require('./rut');

const RESOURCE_TABLE_MAP = {
  cuentas: 'cuentas',
  jugadores: 'jugadores',
  'jugadores-visita': 'jugadores_visita',
  usuarios: 'cuentas',
  encuestas: 'encuestas',
  comunicaciones: 'comunicaciones',
  comentarios: 'comentarios',
  convocatorias: 'convocatorias',
  eventos: 'eventos',
  asistencia: 'asistencia',
  pagos: 'pagos',
  'pagos-mensualidades': 'pagos_mensualidades',
  alertas: 'alertas',
  estadisticas: 'estadisticas',
  marcas: 'marcas_tiempo',
  evaluaciones: 'evaluaciones',
  gamificacion: 'gamificacion_puntos',
  quiz: 'quiz_preguntas',
  pizarra: 'pizarra_tactica',
  resultados: 'resultados',
  'partidos-live': 'partidos_live',
  'asistencia-eventos': 'asistencia_eventos',
  staff: 'staff',
  torneos: 'torneos',
  kiosco: 'caja_evento_kiosco',
  'caja-evento': 'caja_evento_kiosco',
  inventario: 'catalogo_inventario',
  egresos: 'egresos',
  'kiosco-productos': 'kiosco_productos',
  'kiosco-turnos': 'kiosco_turnos',
  'kiosco-ventas': 'kiosco_ventas',
  'kiosco-fiados': 'kiosco_fiados',
  'kiosco-egresos': 'kiosco_egresos',
  clubes: 'clubes',
  lesiones: 'lesiones',
  disciplina: 'disciplina',
  entrenamientos: 'entrenamientos',
  'arriendos-cancha': 'arriendos_cancha',
  'horarios-entrenamiento': 'horarios_entrenamiento',
  // POST /api/becas actualiza jugadores Y beca_historial en la misma
  // transacción — esta entrada cubre jugadores (la más visible/consultada);
  // beca_historial se encola a mano dentro del propio endpoint porque este
  // mapa solo soporta una tabla por recurso.
  becas: 'jugadores',
};

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const normalizarRolSistema = (rol = '') => {
  const raw = String(rol || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'superadmin') return 'super_admin';
  return raw;
};

// Preferir el actor verificado por JWT (req.actor, seteado por el middleware
// authenticate); los headers x-user-* solo quedan como respaldo informativo
// para trazabilidad en rutas sin sesión (no deben usarse para autorizar).
const obtenerActorRequest = (req) => {
  if (req.actor) {
    return {
      id: req.actor.id == null ? null : String(req.actor.id).trim(),
      rut: normalizarRut(String(req.actor.rut || '')),
      rol: req.actor.rol,
    };
  }

  const idHeader = req.headers['x-user-id'];
  const rutHeader = req.headers['x-user-rut'];
  const rolHeader = req.headers['x-user-role'];

  return {
    id: idHeader == null ? null : String(idHeader).trim(),
    rut: normalizarRut(String(rutHeader || '')),
    rol: normalizarRolSistema(rolHeader),
  };
};

const quoteIdent = (ident = '') => `"${String(ident || '').replace(/"/g, '""')}"`;

const getTableFromApiRequest = (req) => {
  const pathParts = String(req.path || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  if (pathParts[0] !== 'api') return '';
  const resource = String(pathParts[1] || '').toLowerCase();
  if (!resource || resource === 'admin' || resource === 'auth') return '';

  // /api/encuestas/:encuestaId/respuesta writes to encuestas_respuestas.
  if (resource === 'encuestas' && String(pathParts[3] || '').toLowerCase() === 'respuesta') {
    return 'encuestas_respuestas';
  }

  // /api/torneos/:id/equipos writes to torneo_equipos, no a torneos.
  if (resource === 'torneos' && String(pathParts[3] || '').toLowerCase() === 'equipos') {
    return 'torneo_equipos';
  }

  return RESOURCE_TABLE_MAP[resource] || '';
};

// El body de cada request mutante se copia a auditoria.valores_nuevos (que a
// su vez se sincroniza al Google Sheet) y al webhook de Apps Script. Antes se
// copiaba tal cual: un reseteo de clave desde el panel admin dejaba la
// contraseña en texto plano en la auditoría y en el Sheet, y un comprobante
// en base64 (varios MB) se duplicaba en cada fila. Se omiten claves
// sensibles y se recortan strings enormes / data URLs.
const CLAVES_SENSIBLES_REGEX = /(password|contrasena|contraseña|clave|token|secret|codigo)/i;
const LARGO_MAXIMO_VALOR_REGISTRO = 2000;

const sanitizarValorParaRegistro = (valor, profundidad = 0) => {
  if (valor == null) return valor;
  if (typeof valor === 'string') {
    if (valor.startsWith('data:')) return `[archivo omitido: ${valor.length} caracteres]`;
    if (valor.length > LARGO_MAXIMO_VALOR_REGISTRO) {
      return `${valor.slice(0, LARGO_MAXIMO_VALOR_REGISTRO)}… [recortado: ${valor.length} caracteres]`;
    }
    return valor;
  }
  if (typeof valor !== 'object') return valor;
  if (profundidad >= 4) return '[objeto anidado omitido]';
  if (Array.isArray(valor)) {
    return valor.slice(0, 200).map((item) => sanitizarValorParaRegistro(item, profundidad + 1));
  }
  return Object.fromEntries(
    Object.entries(valor)
      .slice(0, 60)
      .map(([clave, v]) => [
        clave,
        CLAVES_SENSIBLES_REGEX.test(clave) ? '[omitido]' : sanitizarValorParaRegistro(v, profundidad + 1),
      ])
  );
};

const sanitizarBodyParaRegistro = (body) => (
  body && typeof body === 'object' && !Array.isArray(body) ? sanitizarValorParaRegistro(body) : {}
);

const registrarAuditoriaCambio = async (poolRef, req, tableName) => {
  if (!tableName) return;

  try {
    const actor = obtenerActorRequest(req);
    const registroRaw = req.params?.id || req.params?.rut || req.params?.id_partido || null;
    const registroNumerico = Number.parseInt(String(registroRaw || ''), 10);
    const cambios = Object.fromEntries(Object.entries(sanitizarBodyParaRegistro(req.body)).slice(0, 40));

    await poolRef.query(
      `INSERT INTO auditoria (
        usuario_id,
        tabla_afectada,
        tipo_accion,
        registro_id,
        valores_nuevos,
        descripcion,
        ip_usuario
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        Number.isFinite(Number(actor.id)) ? Number(actor.id) : null,
        tableName,
        String(req.method || '').toUpperCase(),
        Number.isFinite(registroNumerico) ? registroNumerico : null,
        JSON.stringify({
          params: req.params || {},
          changes: cambios,
          actor: {
            id: actor.id || null,
            rut: actor.rut || null,
            rol: actor.rol || null,
          },
        }),
        `Cambio ${String(req.method || '').toUpperCase()} en ${tableName}`,
        req.ip || null,
      ]
    );
  } catch (error) {
    console.error(`[AUDITORIA] No se pudo registrar cambio en ${tableName}: ${error.message}`);
  }
};

module.exports = {
  MUTATING_METHODS,
  obtenerActorRequest,
  getTableFromApiRequest,
  sanitizarBodyParaRegistro,
  registrarAuditoriaCambio,
  normalizarRolSistema,
  quoteIdent,
};
