// Visibilidad por actor: pupilos del actor y qué jugadores/citaciones/contenidos puede ver.
// Extraído de server.js sin cambios de comportamiento.
const { normalizarRutParaComparar } = require('../security/auth');
const { normalizarRol } = require('../security/accessControl');
const { pool } = require('./db');

// Trae los RUT de los pupilos del actor (apoderado) o el propio RUT si el
// actor es un jugador con cuenta propia, junto a su rama/categoría — base
// para filtrar qué citaciones puede ver un usuario no administrativo.
// Además de rut_apoderado/rut_jugador, hace fallback por correo_apoderado:
// mismo criterio que ya usa el frontend (pupilosDisponibles en App.jsx) y
// resolverDestinatariosCitacion, porque no todo jugador tiene rut_apoderado
// completo (el backfill de esa columna no cubre el 100% de los casos) —
// sin este fallback, un apoderado que solo calza por correo vería CERO
// pupilos en vez de los suyos al filtrar por rol.
const obtenerPupilosDeActor = async (actor) => {
  const rutActor = normalizarRutParaComparar(actor.rut);
  const cuentaActor = await pool.query('SELECT correo FROM cuentas WHERE rut = $1', [actor.rut]);
  const correoActor = String(cuentaActor.rows[0]?.correo || '').trim().toLowerCase();

  const result = await pool.query(
    `SELECT rut_jugador, rama, categoria FROM jugadores
     WHERE REPLACE(REPLACE(UPPER(rut_apoderado), '.', ''), '-', '') = $1
        OR REPLACE(REPLACE(UPPER(rut_jugador), '.', ''), '-', '') = $1
        OR ($2 <> '' AND LOWER(TRIM(correo_apoderado)) = $2)`,
    [rutActor, correoActor]
  );
  return result.rows;
};

// Roles cuyo acceso a /api/jugadores debe quedar acotado a sus propios
// pupilos (mismo criterio que esJugadorAutenticado/esPerfilFamiliar en
// App.jsx). Cualquier otro rol (staff, admin, super_admin, etc.) mantiene el
// comportamiento actual sin cambios. 'mesa' (solo módulo scoreboard_live) y
// 'visita' (solo comunicaciones/jugador propio/mesa_publica) recibían el
// roster COMPLETO sin filtrar — incluyendo tipo_sangre, alergias y RUT de
// todos los deportistas, muchos menores de edad — pese a no tener ningún
// módulo que justifique ver el roster ajeno. Ninguno de los dos necesita
// esta lista para su función real (scoreboard/marcador en vivo, o su propia
// ficha), así que quedan acotados igual que jugador/apoderado/socio.
const ROLES_JUGADORES_ACOTADOS = ['jugador', 'apoderado', 'socio', 'socio_apoderado', 'socio-apoderado', 'directiva', 'mesa', 'visita'];

// true si el actor puede ver/actuar sobre ese deportista: cualquier rol no
// acotado (staff/admin/...), o un rol acotado cuyo pupilo (o él mismo) es ese RUT.
const actorPuedeVerJugador = async (actor, rutJugador) => {
  if (!ROLES_JUGADORES_ACOTADOS.includes(normalizarRol(actor?.rol))) return true;
  const objetivo = normalizarRutParaComparar(rutJugador);
  if (!objetivo) return false;
  const pupilos = await obtenerPupilosDeActor(actor);
  return pupilos.some((p) => normalizarRutParaComparar(p.rut_jugador) === objetivo);
};

// Antes también hacía visible una citación a CUALQUIER apoderado/jugador de
// la misma rama/categoría, aunque su pupilo no estuviera convocado — y como
// cargarCitacionConConvocados siempre devuelve el arreglo COMPLETO de
// convocados (nombres, respuesta, morosidad de cada uno), esa familia veía
// la nómina entera de otras/os deportistas que no eran su hija/o. Ahora la
// nómina llega única y exclusivamente a quien fue efectivamente convocado
// (o a quien también esté convocado en esa misma citación, como corresponde
// a un roster compartido de un mismo evento).
const citacionEsVisibleParaPupilos = (citacion, pupilos) => {
  const rutsPupilos = new Set(pupilos.map((p) => normalizarRutParaComparar(p.rut_jugador)));
  return (citacion.convocados || []).some((c) => rutsPupilos.has(normalizarRutParaComparar(c.rut_jugador)));
};

// Mismo criterio que ya usaba el frontend para materiales (AcademiaPanel.jsx
// materialesVisibles): rama 'General' o sin categorias_objetivo = visible
// para toda la rama del pupilo; con categorias_objetivo, el pupilo debe
// calzar. Se usa para dar filtrado real en el servidor a pizarras y quiz,
// que antes no filtraban nada.
const academiaContenidoEsVisibleParaPupilos = (contenido, pupilos) => {
  const ramaContenido = String(contenido.rama || 'General').toLowerCase();
  const categoriasObjetivo = Array.isArray(contenido.categorias_objetivo)
    ? contenido.categorias_objetivo.map((c) => String(c).toLowerCase())
    : [];
  return pupilos.some((p) => {
    const ramaCoincide = ramaContenido === 'general' || ramaContenido === String(p.rama || '').toLowerCase();
    if (!ramaCoincide) return false;
    if (categoriasObjetivo.length === 0) return true;
    return categoriasObjetivo.includes(String(p.categoria || '').toLowerCase());
  });
};

module.exports = {
  obtenerPupilosDeActor,
  academiaContenidoEsVisibleParaPupilos,
  ROLES_JUGADORES_ACOTADOS,
  actorPuedeVerJugador,
  citacionEsVisibleParaPupilos,
};
